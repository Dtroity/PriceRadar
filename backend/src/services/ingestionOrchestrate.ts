import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import * as documentsModel from '../models/documents.js';
import * as ingestionJobs from '../models/ingestionJobs.js';
import { documentQueue, uploadQueue } from '../workers/queue.js';
import { organizationHasModule } from '../modules/_shared/subscriptionRepository.js';
import { classifyIngestionFile, type ClassificationResult, type IngestionKind } from './ingestionClassifier.js';
import type { SourceType } from '../types/index.js';

async function canUsePrice(orgId: string, role: string | undefined): Promise<boolean> {
  if (role === 'super_admin') return true;
  return organizationHasModule(orgId, 'price_monitoring');
}

async function canUseInvoice(orgId: string, role: string | undefined): Promise<boolean> {
  if (role === 'super_admin') return true;
  return organizationHasModule(orgId, 'invoice_ai');
}

export async function routeAfterConfirm(
  row: ingestionJobs.IngestionJobRow,
  organizationId: string,
  kind: IngestionKind,
  supplierName: string,
  sourceType: SourceType,
  role: string | undefined
): Promise<{ bullmqJobId?: string; documentId?: string }> {
  if (kind === 'price_list') {
    if (!(await canUsePrice(organizationId, role))) {
      throw new Error('Модуль мониторинга цен не подключён');
    }
    const job = await uploadQueue.add(
      'process',
      {
        filePath: row.stored_path,
        supplierName: supplierName.trim() || 'Unknown Supplier',
        sourceType,
        mimeType: row.mime_type,
        originalName: row.original_filename,
        organizationId,
        ingestionJobId: row.id,
      },
      { attempts: 2, backoff: { type: 'exponential', delay: 2000 } }
    );
    const id = job.id != null ? String(job.id) : '';
    await ingestionJobs.updateIngestionJob(row.id, organizationId, {
      confirmed_kind: 'price_list',
      status: 'queued',
      bullmq_job_id: id || null,
      error_message: null,
    });
    return { bullmqJobId: id };
  }

  if (!(await canUseInvoice(organizationId, role))) {
    throw new Error('Модуль распознавания документов не подключён');
  }
  const doc = await documentsModel.create(organizationId, row.stored_path, sourceType);
  const dj = await documentQueue.add(
    'parse',
    {
      documentId: doc.id,
      organizationId,
      filePath: row.stored_path,
      mimeType: row.mime_type,
      ingestionJobId: row.id,
    },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
  const djId = dj.id != null ? String(dj.id) : '';
  await ingestionJobs.updateIngestionJob(row.id, organizationId, {
    confirmed_kind: 'invoice_document',
    status: 'queued',
    document_id: doc.id,
    bullmq_job_id: djId || null,
    error_message: null,
  });
  return { documentId: doc.id, bullmqJobId: djId };
}

export function detectionFromClassification(c: ClassificationResult): Record<string, unknown> {
  return {
    suggested: c.suggested,
    alternate: c.alternate,
    priceScore: c.priceScore,
    invoiceScore: c.invoiceScore,
    reasons: c.reasons,
    needsConfirmation: c.needsConfirmation,
    excelPriceLikeRows: c.excelPriceLikeRows ?? null,
  };
}

export function classificationFromDetection(d: Record<string, unknown>): ClassificationResult {
  return {
    suggested: d.suggested as IngestionKind,
    alternate: d.alternate as IngestionKind,
    priceScore: Number(d.priceScore ?? 0),
    invoiceScore: Number(d.invoiceScore ?? 0),
    reasons: Array.isArray(d.reasons) ? (d.reasons as string[]) : [],
    needsConfirmation: Boolean(d.needsConfirmation),
    excelPriceLikeRows: d.excelPriceLikeRows != null ? Number(d.excelPriceLikeRows) : undefined,
  };
}

export type AutoRouteMeta = {
  autoRouted: true;
  fallbackKind?: IngestionKind;
  forcedKind?: IngestionKind;
  note?: string;
};

export async function applyPostClassificationRouting(
  job: ingestionJobs.IngestionJobRow,
  organizationId: string,
  role: string | undefined,
  supplierName: string,
  sourceType: SourceType,
  classification: ClassificationResult
): Promise<
  | { mode: 'auto'; bullmqJobId?: string; documentId?: string; meta: AutoRouteMeta }
  | { mode: 'manual' }
> {
  const okPrice = await canUsePrice(organizationId, role);
  const okInv = await canUseInvoice(organizationId, role);
  const sn = supplierName.trim();
  const wantPrice = classification.suggested === 'price_list';
  const moduleOk = wantPrice ? okPrice : okInv;
  const altOk = wantPrice ? okInv : okPrice;

  if (!classification.needsConfirmation && moduleOk) {
    const kind: IngestionKind = classification.suggested;
    const routed = await routeAfterConfirm(job, organizationId, kind, sn, sourceType, role);
    return { mode: 'auto', ...routed, meta: { autoRouted: true } };
  }

  if (!classification.needsConfirmation && !moduleOk && altOk) {
    const kind: IngestionKind = classification.alternate;
    const routed = await routeAfterConfirm(job, organizationId, kind, sn, sourceType, role);
    return { mode: 'auto', ...routed, meta: { autoRouted: true, fallbackKind: kind } };
  }

  if (classification.needsConfirmation && okPrice && !okInv) {
    const routed = await routeAfterConfirm(
      job,
      organizationId,
      'price_list',
      sn || 'Unknown Supplier',
      sourceType,
      role
    );
    return {
      mode: 'auto',
      ...routed,
      meta: { autoRouted: true, forcedKind: 'price_list', note: 'only_price_module' },
    };
  }

  if (classification.needsConfirmation && !okPrice && okInv) {
    const routed = await routeAfterConfirm(job, organizationId, 'invoice_document', sn, sourceType, role);
    return {
      mode: 'auto',
      ...routed,
      meta: { autoRouted: true, forcedKind: 'invoice_document', note: 'only_invoice_module' },
    };
  }

  return { mode: 'manual' };
}

/** Когда UI недоступен (Telegram): при неоднозначности и обоих модулях — suggested. */
export async function routeIngestionWithoutUiConfirm(
  job: ingestionJobs.IngestionJobRow,
  organizationId: string,
  role: string | undefined,
  classification: ClassificationResult,
  supplierName: string,
  sourceType: SourceType
): Promise<{ bullmqJobId?: string; documentId?: string }> {
  const auto = await applyPostClassificationRouting(
    job,
    organizationId,
    role,
    supplierName,
    sourceType,
    classification
  );
  if (auto.mode === 'auto') {
    return { bullmqJobId: auto.bullmqJobId, documentId: auto.documentId };
  }
  const kind: IngestionKind = classification.suggested;
  const sn = kind === 'price_list' ? supplierName.trim() || 'Unknown Supplier' : supplierName.trim();
  return routeAfterConfirm(job, organizationId, kind, sn, sourceType, role);
}

const TELEGRAM_ROUTE_ROLE = 'manager';

/**
 * Полный путь ingestion после сохранения файла на диск (веб init, Telegram и т.д.).
 * Дубликаты по хэшу не блокируют: фиксируем duplicate_of_id и всё равно ставим в очередь.
 */
export async function submitIngestionFromUploadedFile(opts: {
  organizationId: string;
  userId: string | null;
  filePath: string;
  originalName: string;
  mimeType: string;
  sourceType: SourceType;
  supplierName: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const role = TELEGRAM_ROUTE_ROLE;
  const okPrice = await canUsePrice(opts.organizationId, role);
  const okInv = await canUseInvoice(opts.organizationId, role);
  if (!okPrice && !okInv) {
    await unlink(opts.filePath).catch(() => {});
    return { ok: false, message: 'Нет доступных модулей для обработки файла.' };
  }

  let buf: Buffer;
  try {
    buf = await readFile(opts.filePath);
  } catch {
    return { ok: false, message: 'Не удалось прочитать файл.' };
  }
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const dup = await ingestionJobs.findRecentDuplicateByHash(opts.organizationId, sha256, 90);

  let classification: ClassificationResult;
  try {
    classification = await classifyIngestionFile({
      filePath: opts.filePath,
      mimeType: opts.mimeType,
      originalName: opts.originalName,
    });
  } catch {
    await unlink(opts.filePath).catch(() => {});
    return { ok: false, message: 'Не удалось классифицировать файл.' };
  }

  const baseDetection = detectionFromClassification(classification);
  const detection = dup
    ? { ...baseDetection, duplicateOfId: dup.id, telegramAutoDuplicate: true }
    : baseDetection;

  const job = await ingestionJobs.createIngestionJob({
    organizationId: opts.organizationId,
    userId: opts.userId,
    originalFilename: opts.originalName,
    storedPath: opts.filePath,
    mimeType: opts.mimeType,
    sourceType: opts.sourceType,
    fileSha256: sha256,
    suggestedKind: classification.suggested,
    status: 'pending_confirm',
    detection,
    duplicateOfId: dup?.id ?? null,
  });

  try {
    await routeIngestionWithoutUiConfirm(
      job,
      opts.organizationId,
      role,
      classification,
      opts.supplierName,
      opts.sourceType
    );
  } catch (err) {
    await ingestionJobs.updateIngestionJob(job.id, opts.organizationId, {
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Ошибка маршрутизации',
    });
    return { ok: false, message: err instanceof Error ? err.message : 'Ошибка постановки в очередь.' };
  }

  return {
    ok: true,
    message: dup
      ? 'Файл принят (как предыдущая загрузка по содержимому), поставлен в очередь на разбор.'
      : 'Файл принят, поставлен в очередь на разбор.',
  };
}
