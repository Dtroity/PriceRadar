import { parseBuffer } from '../parsers/index.js';
import * as suppliersModel from '../models/suppliers.js';
import * as productsModel from '../models/products.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import { compareAndSaveChanges } from '../services/priceComparison.js';
import { notifyPriceChange } from '../services/telegramNotify.js';
import { readFile } from 'fs/promises';
import path from 'path';
function resolveFilePath(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}
export async function processUploadJob(job) {
    const { filePath, supplierName, sourceType, mimeType, originalName } = job.data;
    const buffer = await readFile(resolveFilePath(filePath));
    const rows = await parseBuffer(buffer, mimeType, originalName);
    if (rows.length === 0) {
        job.log('No rows parsed');
        return;
    }
    const supplier = await suppliersModel.findOrCreateSupplier(supplierName);
    const uploadDate = new Date();
    const priceList = await priceListsModel.createPriceList(supplier.id, uploadDate, sourceType, filePath);
    const priceItems = [];
    for (const row of rows) {
        const product = await productsModel.findOrCreateProduct(row.product_name, row.normalized_name, false);
        priceItems.push({
            product_id: product.id,
            price: row.price,
            currency: row.currency,
        });
    }
    await pricesModel.insertPrices(priceList.id, priceItems);
    const { changes } = await compareAndSaveChanges(supplier.id, priceList.id, rows, uploadDate);
    for (const ch of changes) {
        await notifyPriceChange(supplierName, ch.productName, ch.oldPrice, ch.newPrice, ch.changePercent, ch.isPriority);
    }
    job.log(`Processed ${rows.length} rows, ${changes.length} changes`);
}
