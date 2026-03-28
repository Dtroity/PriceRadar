import { classifyDocument } from './documentClassifier.js';
import { parseWithAiFromFile } from './aiTableParser.js';
import { parseExcel } from '../parsers/excelParser.js';
import { parseCsv } from '../parsers/csvParser.js';
import type { NormalizedRow } from '../types/index.js';
import { readFile } from 'fs/promises';

export interface ParserPipelineInput {
  filePath: string;
  mimeType: string;
  originalName: string;
}

export async function runParserPipeline(
  input: ParserPipelineInput
): Promise<NormalizedRow[]> {
  const { filePath, mimeType, originalName } = input;
  const { kind } = classifyDocument(originalName, mimeType);

  if (kind === 'excel') {
    const buf = await readFile(filePath);
    const fromSheet = await parseExcel(buf);
    if (fromSheet.length > 0) return fromSheet;
    return parseWithAiFromFile(filePath, mimeType, originalName);
  }
  if (kind === 'csv') {
    const buf = await readFile(filePath);
    const fromCsv = parseCsv(buf);
    if (fromCsv.length > 0) return fromCsv;
    return parseWithAiFromFile(filePath, mimeType, originalName);
  }

  const rows = await parseWithAiFromFile(filePath, mimeType, originalName);
  return rows;
}

