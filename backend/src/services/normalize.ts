import type { NormalizedRow } from '../types/index.js';

/**
 * Normalize product name for matching across suppliers.
 * - lowercase
 * - remove extra symbols
 * - remove packaging info (weight, kg, etc.)
 */
export function normalizeProductName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let s = name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  // Remove packaging patterns: 1kg, 500г, 0.5л, etc.
  s = s.replace(/\d+\s*(kg|кг|g|г|л|l|ml|мл)\b/gi, '').trim();
  s = s.replace(/\b\d+[\.,]?\d*\s*(kg|кг|g|г|л|l|ml|мл)\b/gi, '').trim();
  // Remove special chars except spaces and basic letters/numbers
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function normalizeRow(
  productName: string,
  price: number,
  currency: string,
  supplier?: string
): NormalizedRow {
  const normalized_name = normalizeProductName(productName);
  return {
    product_name: productName.trim(),
    normalized_name: normalized_name || productName.trim().toLowerCase(),
    price: Number(price) || 0,
    currency: currency || 'RUB',
    supplier,
  };
}
