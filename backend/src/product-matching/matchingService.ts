import type { NormalizedRow, Product } from '../types/index.js';
import * as productsModel from '../models/products.js';
import * as productNameAliasesModel from '../models/productNameAliases.js';
import { bestFuzzyMatch } from './fuzzyMatcher.js';
import { normalizeProductName } from './normalizeRules.js';

const FUZZY_MAX_SCORE = 0.35;

export async function matchProductForRow(
  row: NormalizedRow,
  _supplierName: string,
  organizationId?: string
): Promise<Product> {
  const rawName = row.product_name.trim();
  const ruleNormalized = normalizeProductName(rawName);
  const normalizedByRuleOrRow = ruleNormalized || row.normalized_name;

  let aliasNormalized = normalizedByRuleOrRow;
  if (organizationId) {
    const alias = await productNameAliasesModel.findByRawName(organizationId, rawName);
    if (alias) {
      aliasNormalized = alias.normalized_name;
    } else {
      await productNameAliasesModel.ensure(organizationId, rawName, normalizedByRuleOrRow);
    }
  }

  const exact = await productsModel.findProductByNormalizedName(aliasNormalized, organizationId);
  if (exact) {
    return exact;
  }

  const allProducts = await productsModel.getAllProducts(organizationId);
  const fuzzy = bestFuzzyMatch(allProducts, aliasNormalized);
  if (fuzzy && fuzzy.score <= FUZZY_MAX_SCORE) {
    return fuzzy.product;
  }

  const created = await productsModel.createProduct(
    rawName,
    aliasNormalized,
    false,
    organizationId
  );
  return created;
}

