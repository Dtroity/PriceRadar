import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { runOcr } from './ocrProcessor.js';
import { classifyDocument } from './documentClassifier.js';
import { completeJson } from './client.js';
import type { NormalizedRow } from '../types/index.js';
import { normalizeRow } from '../services/normalize.js';

interface AiParsedProduct {
  name: string;
  normalized_name?: string;
  price: number;
  currency?: string;
}

interface AiParseResponse {
  products: AiParsedProduct[];
}

const BASE_PROMPT = `
You are an intelligent document parser.

Extract products and prices from supplier price lists.

Documents may contain:
- tables
- broken formatting
- multiple languages
- packaging info

Requirements:
- Ignore header/footer noise.
- For each product row, extract product name and price.
- Ignore rows without a numeric price.
- Normalize decimals (use dot as decimal separator).
- Try to infer currency; if missing, use "RUB".

Return JSON only, no explanations:

{
  "products": [
    {
      "name": "original product name from the document",
      "normalized_name": "normalized name",
      "price": 123.45,
      "currency": "RUB"
    }
  ]
}
`.trim();

export async function parseWithAiFromFile(
  filePath: string,
  mimeType: string,
  originalName: string
): Promise<NormalizedRow[]> {
  const { kind } = classifyDocument(originalName, mimeType);

  if (kind === 'excel' || kind === 'csv') {
    return [];
  }

  let text = '';
  if (kind === 'pdf') {
    const buf = await readFile(filePath);
    const data = await pdfParse(buf);
    text = data.text || '';
  } else if (kind === 'word') {
    const buf = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    text = result.value || '';
  } else if (kind === 'image') {
    text = await runOcr(filePath);
  } else {
    const buf = await readFile(filePath);
    text = buf.toString('utf-8');
  }

  if (!text.trim()) return [];

  const prompt = `${BASE_PROMPT}\n\nDocument text:\n\"\"\"\n${text.slice(0, 8000)}\n\"\"\"`;
  const json = await completeJson<AiParseResponse>(prompt);
  if (!json?.products?.length) return [];

  const rows: NormalizedRow[] = [];
  for (const p of json.products) {
    const price = Number(p.price);
    if (!p.name || Number.isNaN(price) || price <= 0) continue;
    const currency = (p.currency || 'RUB').toUpperCase();
    const row = normalizeRow(p.name, price, currency);
    if (p.normalized_name) {
      row.normalized_name = p.normalized_name.toLowerCase();
    }
    rows.push(row);
  }

  return rows;
}

