import { readFile } from 'fs/promises';
import path from 'path';
import XLSX from 'xlsx';

export type IngestionKind = 'price_list' | 'invoice_document';

export interface ClassificationResult {
  /** Лучшее предположение (кнопка по умолчанию в UI). */
  suggested: IngestionKind;
  alternate: IngestionKind;
  priceScore: number;
  invoiceScore: number;
  reasons: string[];
  needsConfirmation: boolean;
  excelPriceLikeRows?: number;
}

const INVOICE_RE =
  /накладн|упд|сч[её]т[-\s]?факт|универсальн(ый|ого)?\s+передат|поставщик|покупатель|грузополуч|итого\s+к\s+оплат|сумма\s+ндс|всего\s+с\s+ндс|ттн|реализац/i;
const PRICE_RE =
  /прайс|розничн|оптов|мрц|рекомендован|артикул|ед\.?\s*изм|код\s+товар|наименовани.*цена|price\s*list/i;

function scoreTextBlob(text: string): { inv: number; pr: number; hits: string[] } {
  const t = text.slice(0, 120_000).toLowerCase();
  const hits: string[] = [];
  let inv = 0;
  let pr = 0;
  const im = t.match(INVOICE_RE);
  const pm = t.match(PRICE_RE);
  if (im) {
    inv += 0.35;
    hits.push('invoice_keywords');
  }
  if (pm) {
    pr += 0.35;
    hits.push('price_keywords');
  }
  return { inv, pr, hits };
}

function sampleExcelPriceLikeRows(buffer: Buffer): number {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    let best = 0;
    for (const sn of wb.SheetNames) {
      const sh = wb.Sheets[sn];
      if (!sh) continue;
      const m = XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, defval: '', raw: false }) as unknown[][];
      const rows = m.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
      if (rows.length < 2) continue;
      let cnt = 0;
      const maxR = Math.min(rows.length, 120);
      for (let r = 1; r < maxR; r++) {
        const row = rows[r] as unknown[];
        const texts = row.map((c) => String(c ?? '').trim()).filter(Boolean);
        if (texts.length < 2) continue;
        const nums = row.filter((c) => {
          if (typeof c === 'number' && c > 0) return true;
          const s = String(c ?? '').replace(/\s/g, '').replace(',', '.');
          const n = parseFloat(s.replace(/[^\d.-]/g, ''));
          return !Number.isNaN(n) && n > 0;
        });
        if (nums.length >= 1 && texts.length >= 2) cnt += 1;
      }
      if (cnt > best) best = cnt;
    }
    return best;
  } catch {
    return 0;
  }
}

export async function classifyIngestionFile(input: {
  filePath: string;
  mimeType: string;
  originalName: string;
}): Promise<ClassificationResult> {
  const ext = path.extname(input.originalName).toLowerCase();
  const mt = (input.mimeType || '').toLowerCase();
  const reasons: string[] = [];

  let priceScore = 0;
  let invoiceScore = 0;
  let excelPriceLikeRows = 0;

  if (mt.includes('pdf') || ext === '.pdf') {
    invoiceScore = 0.85;
    reasons.push('pdf_usually_invoice');
  } else if (mt.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext)) {
    invoiceScore = 0.88;
    reasons.push('image_usually_invoice');
  } else if (['.xlsx', '.xls', '.csv'].includes(ext) || mt.includes('spreadsheet') || mt.includes('excel')) {
    const buf = await readFile(input.filePath).catch(() => null);
    if (buf && buf.length > 0) {
      const slice = buf.length > 4_000_000 ? buf.subarray(0, 4_000_000) : buf;
      const textProbe = slice.toString('utf8').slice(0, 8_000);
      const { inv, pr, hits } = scoreTextBlob(textProbe + ' ' + input.originalName);
      invoiceScore += inv;
      priceScore += pr;
      reasons.push(...hits);

      if (['.xlsx', '.xls'].includes(ext) || mt.includes('spreadsheet')) {
        excelPriceLikeRows = sampleExcelPriceLikeRows(slice);
        if (excelPriceLikeRows >= 8) {
          priceScore += 0.45;
          reasons.push(`excel_grid_${excelPriceLikeRows}`);
        } else if (excelPriceLikeRows >= 3) {
          priceScore += 0.25;
          reasons.push(`excel_some_rows_${excelPriceLikeRows}`);
        }
      }
      if (ext === '.csv' || mt.includes('csv')) {
        const lines = textProbe.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length >= 4) {
          const sep = lines[0].includes(';') ? ';' : ',';
          const head = lines[0].toLowerCase();
          if (/(товар|наимен|цена|price|sum)/.test(head)) {
            priceScore += 0.35;
            reasons.push('csv_header_pricey');
          }
        }
      }
    }
  } else if (['.doc', '.docx'].includes(ext) || mt.includes('word')) {
    invoiceScore = 0.42;
    priceScore = 0.38;
    reasons.push('word_ambiguous');
  } else {
    invoiceScore = 0.4;
    priceScore = 0.35;
    reasons.push('unknown_ext');
  }

  priceScore = Math.min(1, priceScore);
  invoiceScore = Math.min(1, invoiceScore);

  const suggested: IngestionKind = priceScore >= invoiceScore ? 'price_list' : 'invoice_document';
  const alternate: IngestionKind = suggested === 'price_list' ? 'invoice_document' : 'price_list';
  const top = Math.max(priceScore, invoiceScore);
  const diff = Math.abs(priceScore - invoiceScore);
  const needsConfirmation =
    top < 0.38 || diff < 0.14 || (priceScore >= 0.22 && invoiceScore >= 0.22 && diff < 0.2);

  return {
    suggested,
    alternate,
    priceScore,
    invoiceScore,
    reasons,
    needsConfirmation,
    excelPriceLikeRows,
  };
}
