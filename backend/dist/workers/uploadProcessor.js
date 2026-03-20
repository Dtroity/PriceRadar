import { runParserPipeline } from '../ai/parserPipeline.js';
import * as suppliersModel from '../models/suppliers.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import { compareAndSaveChanges } from '../services/priceComparison.js';
import { notifyPriceChange } from '../services/telegramNotify.js';
import { recordFromPriceList } from '../services/supplierPricesHistory.js';
import { matchProductForRow } from '../product-matching/matchingService.js';
import path from 'path';
function resolveFilePath(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}
export async function processUploadJob(job) {
    const { filePath, supplierName, sourceType, mimeType, originalName } = job.data;
    const absPath = resolveFilePath(filePath);
    const rows = await runParserPipeline({
        filePath: absPath,
        mimeType,
        originalName,
    });
    if (rows.length === 0) {
        job.log('No rows parsed');
        return;
    }
    const organizationId = job.data.organizationId;
    const supplier = organizationId
        ? await import('../models/suppliers-mt.js').then((m) => m.findOrCreate(organizationId, supplierName))
        : await suppliersModel.findOrCreateSupplier(supplierName);
    const uploadDate = new Date();
    const priceList = await priceListsModel.createPriceList(supplier.id, uploadDate, sourceType, filePath, organizationId);
    const priceItems = [];
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
        }
        catch (e) {
            job.log('supplier_prices_history record failed: ' + (e instanceof Error ? e.message : ''));
        }
    }
    const { changes } = await compareAndSaveChanges(supplier.id, priceList.id, uploadDate, job.data.organizationId);
    for (const ch of changes) {
        await notifyPriceChange(supplierName, ch.productName, ch.oldPrice, ch.newPrice, ch.changePercent, ch.isPriority);
    }
    job.log(`Processed ${rows.length} rows, ${changes.length} changes`);
}
