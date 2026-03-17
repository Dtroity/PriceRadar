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
    return parseExcel(buf);
  }
  if (kind === 'csv') {
    const buf = await readFile(filePath);
    return parseCsv(buf);
  }

  const rows = await parseWithAiFromFile(filePath, mimeType, originalName);
  return rows;
}

