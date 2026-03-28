import type { Job } from 'bullmq';
import { runParserPipeline } from '../ai/parserPipeline.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import { compareAndSaveChanges } from '../services/priceComparison.js';
import { notifyPriceChange } from '../services/telegramNotify.js';
import { recordFromPriceList } from '../services/supplierPricesHistory.js';
import type { SourceType } from '../types/index.js';
import { matchProductForRow } from '../product-matching/matchingService.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import * as ingestionJobs from '../models/ingestionJobs.js';

function resolveFilePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export interface UploadJobPayload {
  filePath: string;
  supplierName: string;
  sourceType: SourceType;
  mimeType: string;
  originalName: string;
  organizationId?: string;
  ingestionJobId?: string;
}

export async function processUploadJob(job: Job<UploadJobPayload>): Promise<void> {
  const { filePath, supplierName, sourceType, mimeType, originalName, ingestionJobId } = job.data;
  const organizationId = job.data.organizationId;

  if (ingestionJobId && organizationId) {
    await ingestionJobs.updateIngestionJob(ingestionJobId, organizationId, { status: 'processing' });
  }

  if (!organizationId) {
    const msg = config.multiTenant
      ? 'Прайс не обработан: нет organizationId. Войдите в веб с workspace или привяжите Telegram-пользователя к организации (Настройки → Telegram).'
      : 'Прайс не обработан: organizationId обязателен для записи в price_lists.';
    logger.error({ jobId: job.id, originalName }, msg);
    await job.log(msg);
    throw new Error(msg);
  }

  try {
    const absPath = resolveFilePath(filePath);
    const rows = await runParserPipeline({
      filePath: absPath,
      mimeType,
      originalName,
    });
    if (rows.length === 0) {
      const msg = `Файл разобран, но строк с ценами не найдено: ${originalName}`;
      logger.warn({ jobId: job.id, originalName }, msg);
      await job.log(msg);
      throw new Error(msg);
    }

    const supplier = await import('../models/suppliers-mt.js').then((m) =>
      m.findOrCreate(organizationId, supplierName)
    );
    const uploadDate = new Date();
    const priceList = await priceListsModel.createPriceList(
      supplier.id,
      uploadDate,
      sourceType,
      filePath,
      organizationId
    );

    const priceItems: { product_id: string; price: number; currency: string }[] = [];
    for (const row of rows) {
      const product = await matchProductForRow(row, supplier.name, organizationId);
      priceItems.push({
        product_id: product.id,
        price: row.price,
        currency: row.currency,
      });
    }
    await pricesModel.insertPrices(priceList.id, priceItems);

    if (organizationId) {
      try {
        await recordFromPriceList(priceList.id);
      } catch (e) {
        job.log('supplier_prices_history record failed: ' + (e instanceof Error ? e.message : ''));
      }
    }

    const { changes, hadPreviousPriceList } = await compareAndSaveChanges(
      supplier.id,
      priceList.id,
      uploadDate,
      job.data.organizationId
    );

    for (const ch of changes) {
      await notifyPriceChange(
        supplierName,
        ch.productName,
        ch.oldPrice,
        ch.newPrice,
        ch.changePercent,
        ch.isPriority
      );
    }

    if (ingestionJobId) {
      await ingestionJobs.updateIngestionJob(ingestionJobId, organizationId, {
        status: 'completed',
        price_list_id: priceList.id,
        summary: {
          rows: rows.length,
          changes: changes.length,
          supplierName: supplier.name,
          supplierId: supplier.id,
          hadPreviousPriceList,
        },
        error_message: null,
      });
    }

    const done = `Processed ${rows.length} rows, ${changes.length} changes`;
    await job.log(done);
    logger.info({ jobId: job.id, originalName, rows: rows.length, changes: changes.length }, done);
  } catch (err) {
    if (ingestionJobId && organizationId) {
      await ingestionJobs.updateIngestionJob(ingestionJobId, organizationId, {
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}
