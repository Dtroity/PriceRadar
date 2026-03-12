import type { NormalizedRow } from '../types/index.js';
/**
 * Simple CSV parser (comma or semicolon separated).
 */
export declare function parseCsv(buffer: Buffer): NormalizedRow[];
