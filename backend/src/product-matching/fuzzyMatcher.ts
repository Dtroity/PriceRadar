import Fuse from 'fuse.js';
import type { Product } from '../types/index.js';

export interface FuzzyMatchResult {
  product: Product;
  score: number;
}

export function createFuzzyIndex(products: Product[]): Fuse<Product> {
  return new Fuse(products, {
    keys: ['normalized_name', 'name'],
    includeScore: true,
    threshold: 0.4,
  });
}

export function bestFuzzyMatch(
  products: Product[],
  normalizedName: string
): FuzzyMatchResult | null {
  if (!products.length) return null;
  const fuse = createFuzzyIndex(products);
  const results = fuse.search(normalizedName);
  if (!results.length) return null;
  const best = results[0];
  if (best.score == null) return null;
  return { product: best.item, score: best.score };
}

