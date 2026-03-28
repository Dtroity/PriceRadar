import type { NormalizedRow } from '../types/index.js';
/** Убирает типичный мусор из ячеек Excel (ведущие слэши, пробелы). */
export declare function sanitizeRawProductName(name: string): string;
/**
 * Normalize product name for matching across suppliers.
 * - lowercase
 * - remove extra symbols
 * - remove packaging info (weight, kg, etc.)
 */
export declare function normalizeProductName(name: string): string;
export declare function normalizeRow(productName: string, price: number, currency: string, supplier?: string): NormalizedRow;
