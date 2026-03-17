import type { NormalizedRow } from '../types/index.js';
import { normalizeRow } from '../services/normalize.js';

export interface RawProductRow {
  name: string;
  price: number;
  currency?: string;
}

export function toNormalizedRows(rows: RawProductRow[]): NormalizedRow[] {
  return rows
    .map((r) =>
      normalizeRow(
        r.name,
        r.price,
        (r.currency || 'RUB').toUpperCase()
      )
    )
    .filter((r) => r.product_name && r.price > 0);
}

