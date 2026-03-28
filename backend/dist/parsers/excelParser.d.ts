/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import type { NormalizedRow } from '../types/index.js';
/**
 * Parse Excel (XLS/XLSX) and extract product name + price columns.
 * Tries multiple header rows and sheets — many RU price lists have title rows above the table.
 */
export declare function parseExcel(buffer: Buffer): Promise<NormalizedRow[]>;
