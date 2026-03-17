import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';
import * as priceChangesModel from '../models/priceChanges.js';
import * as productsModel from '../models/products.js';
import { foodcostRecalcQueue } from '../modules/foodcost/worker.js';

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
 * 2. Compare prices by product_id and create price_changes
 */
export async function compareAndSaveChanges(
  supplierId: string,
  newPriceListId: string,
  uploadDate: Date,
  organizationId?: string
): Promise<ComparisonResult> {
  const previousList = await priceListsModel.getPreviousPriceList(
    supplierId,
    uploadDate,
    organizationId
  );
  if (!previousList) return { changes: [] };

  const oldPrices = await pricesModel.getPricesByPriceListId(previousList.id);
  const newPrices = await pricesModel.getPricesByPriceListId(newPriceListId);
  const oldByProductId = new Map(oldPrices.map((p) => [p.product_id, p.price]));
  const changes: ComparisonResult['changes'] = [];

  for (const p of newPrices) {
    const oldPrice = oldByProductId.get(p.product_id);
    if (oldPrice == null) continue;
    const newPrice = p.price;
    if (Math.abs(newPrice - oldPrice) < 0.01) continue;

    const product = await productsModel.getProductById(p.product_id);
    const isPriority = product?.is_priority ?? false;
    await priceChangesModel.createPriceChange(p.product_id, supplierId, oldPrice, newPrice, isPriority, organizationId);
    if (organizationId) {
      foodcostRecalcQueue.add('recalc', { organizationId, productId: p.product_id }).catch(() => {});
    }
    const changeValue = newPrice - oldPrice;
    const changePercent = oldPrice !== 0 ? (changeValue / oldPrice) * 100 : 0;
    changes.push({
      productId: p.product_id,
      productName: product?.name ?? '',
      oldPrice,
      newPrice,
      changeValue,
      changePercent,
      isPriority,
    });
  }

  return { changes };
}
