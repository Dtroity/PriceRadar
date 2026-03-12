import type { NormalizedRow } from '../types/index.js';
import * as productsModel from '../models/products.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import * as priceChangesModel from '../models/priceChanges.js';

export interface ComparisonResult {
  changes: Array<{
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    changeValue: number;
    changePercent: number;
    isPriority: boolean;
  }>;
}

/**
 * After saving new price list and prices:
 * 1. Find previous price list for this supplier
 * 2. Match products by normalized_name
 * 3. Compare prices and create price_changes
 */
export async function compareAndSaveChanges(
  supplierId: string,
  newPriceListId: string,
  newRows: NormalizedRow[],
  uploadDate: Date
): Promise<ComparisonResult> {
  const previousList = await priceListsModel.getPreviousPriceList(
    supplierId,
    uploadDate
  );
  if (!previousList) return { changes: [] };

  const oldPrices = await pricesModel.getPricesByPriceListId(previousList.id);
  const oldByProductId = new Map(oldPrices.map((p) => [p.product_id, p.price]));
  const changes: ComparisonResult['changes'] = [];

  for (const row of newRows) {
    const product = await productsModel.findOrCreateProduct(
      row.product_name,
      row.normalized_name,
      false
    );
    const oldPrice = oldByProductId.get(product.id);
    if (oldPrice == null) continue;
    const newPrice = row.price;
    if (Math.abs(newPrice - oldPrice) < 0.01) continue;

    await priceChangesModel.createPriceChange(
      product.id,
      supplierId,
      oldPrice,
      newPrice,
      product.is_priority
    );
    const changeValue = newPrice - oldPrice;
    const changePercent = oldPrice !== 0 ? (changeValue / oldPrice) * 100 : 0;
    changes.push({
      productId: product.id,
      productName: row.product_name,
      oldPrice,
      newPrice,
      changeValue,
      changePercent,
      isPriority: product.is_priority,
    });
  }

  return { changes };
}
