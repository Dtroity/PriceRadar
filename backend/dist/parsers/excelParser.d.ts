/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import type { NormalizedRow } from '../types/index.js';
/**
 * Parse Excel (XLS/XLSX) and extract product name + price columns.
 * Tries to auto-detect columns by headers (name, product, price, cost, etc.)
 */
export declare function parseExcel(buffer: Buffer): Promise<NormalizedRow[]>;
