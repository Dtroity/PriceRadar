import type { NormalizedRow, Product } from '../types/index.js';
import * as productsModel from '../models/products.js';
import * as productAliasesModel from '../models/productAliases.js';
import { bestFuzzyMatch } from './fuzzyMatcher.js';
import { aiMatch } from './aiMatcher.js';

const FUZZY_MAX_SCORE = 0.35;
const AI_MIN_CONFIDENCE = 85;

export async function matchProductForRow(
  row: NormalizedRow,
  supplierName: string,
  organizationId?: string
): Promise<Product> {
  const supplier = supplierName.trim();
  const alias = await productAliasesModel.findAlias(supplier, row.product_name, organizationId);
  if (alias) {
    const existing = await productsModel.getProductById(alias.product_id);
    if (existing) return existing;
  }

  const exact = await productsModel.findProductByNormalizedName(row.normalized_name, organizationId);
  if (exact) {
    await ensureAlias(exact.id, supplier, row.product_name, 100, organizationId);
    return exact;
  }

  const allProducts = await productsModel.getAllProducts(organizationId);
  const fuzzy = bestFuzzyMatch(allProducts, row.normalized_name);
  if (fuzzy && fuzzy.score <= FUZZY_MAX_SCORE) {
    const ai = await aiMatch(fuzzy.product.name, row.product_name);
    if (ai.same_product && ai.confidence >= AI_MIN_CONFIDENCE) {
      await ensureAlias(fuzzy.product.id, supplier, row.product_name, ai.confidence, organizationId);
      return fuzzy.product;
    }
  }

  const created = await productsModel.createProduct(
    row.product_name,
    row.normalized_name,
    false,
    organizationId
  );
  await ensureAlias(created.id, supplier, row.product_name, 100, organizationId);
  return created;
}

async function ensureAlias(
  productId: string,
  supplierName: string,
  aliasName: string,
  confidence: number,
  organizationId?: string
) {
  const existing = await productAliasesModel.findAlias(supplierName, aliasName, organizationId);
  if (existing) return;
  await productAliasesModel.createAlias(productId, supplierName, aliasName, confidence, organizationId);
}

