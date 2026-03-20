import type { Product } from '../types/index.js';
import * as productsModel from '../models/products.js';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*(кг|л|шт|г|мл|упак|уп)\.?\s*/gi, ' ')
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const d = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length, 1);
  return 1 - d / maxLen;
}

export async function findDuplicatePairs(
  organizationId: string,
  threshold: number
): Promise<Array<{ product1: Product; product2: Product; similarity: number }>> {
  const products = await productsModel.getAllProducts(organizationId);
  const pairs: Array<{ product1: Product; product2: Product; similarity: number }> = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const p1 = products[i];
      const p2 = products[j];
      const sim = nameSimilarity(p1.normalized_name, p2.normalized_name);
      if (sim >= threshold) {
        pairs.push({ product1: p1, product2: p2, similarity: sim });
      }
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity);
  return pairs;
}

/**
 * Repeatedly merges the strongest duplicate pair (older product kept as target) until none ≥ threshold.
 */
export async function runAutoMergeDuplicates(
  organizationId: string,
  threshold: number,
  actorUserId: string | null
): Promise<number> {
  let merged = 0;
  const maxIterations = 500;
  for (let k = 0; k < maxIterations; k++) {
    const pairs = await findDuplicatePairs(organizationId, threshold);
    if (pairs.length === 0) break;
    const { product1, product2 } = pairs[0];
    const t1 = new Date(product1.created_at).getTime();
    const t2 = new Date(product2.created_at).getTime();
    const [older, newer] = t1 <= t2 ? [product1, product2] : [product2, product1];
    try {
      await productsModel.mergeProducts({
        organizationId,
        targetProductId: older.id,
        sourceProductIds: [newer.id],
        actorUserId,
      });
      merged += 1;
    } catch {
      break;
    }
  }
  return merged;
}
