import { parseExcel } from './excelParser.js';
import { parseCsv } from './csvParser.js';
import type { NormalizedRow } from '../types/index.js';
export type ParserType = 'excel' | 'csv' | 'pdf' | 'doc' | 'ocr';
export declare function parseBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<NormalizedRow[]>;
export { parseExcel, parseCsv };
