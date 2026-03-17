import * as productAliases from '../../models/productAliases.js';
import * as productsModel from '../../models/products.js';

/**
 * When user maps OCR line "Tomato fresh kg" → product_id, create alias
 * so next OCR matches reuse it.
 */
export async function learnFromMapping(
  organizationId: string,
  supplierName: string,
  rawItemName: string,
  productId: string
): Promise<void> {
  if (!supplierName?.trim() || !rawItemName?.trim() || !productId) return;
  const existing = await productAliases.findAlias(supplierName, rawItemName.trim(), organizationId);
  if (existing) return;
  const product = await productsModel.getProductById(productId);
  if (!product) return;
  await productAliases.createAlias(productId, supplierName.trim(), rawItemName.trim(), 100, organizationId);
}
