import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import type { NormalizedRow } from '../types/index.js';
import { normalizeRow } from '../services/normalize.js';

/**
 * Parse Excel (XLS/XLSX) and extract product name + price columns.
 * Tries multiple header rows and sheets — many RU price lists have title rows above the table.
 */
export async function parseExcel(buffer: Buffer): Promise<NormalizedRow[]> {
  const fromExcelJs = await parseWithExcelJs(buffer);
  if (fromExcelJs.length > 0) return fromExcelJs;
  return parseWithXlsx(buffer);
}

function parsePrice(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(normalized) || 0;
  }
  return 0;
}

function toMatrix(rows: unknown[][]): unknown[][] {
  return rows
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some((v) => String(v ?? '').trim() !== ''));
}

const NAME_KEYS = [
  'name',
  'product',
  'товар',
  'наименование',
  'название',
  'product name',
  'номенклатура',
  'описание',
  'наимен',
  'продукция',
  'изделие',
];
const PRICE_KEYS = [
  'price',
  'cost',
  'цена',
  'стоимость',
  'руб',
  'sum',
  'сумма',
  'amount',
  'к оплате',
  'итого',
  'всего',
  'ст-ть',
  'стоим',
  'цена за',
  'розничн',
  'тариф',
];

function detectColumnsFromHeader(headerCells: unknown[]): { nameCol: number; priceCol: number } {
  const header = headerCells.map((c) => String(c ?? '').toLowerCase());
  let nameCol = -1;
  let priceCol = -1;
  for (let i = 0; i < header.length; i++) {
    const h = header[i] ?? '';
    if (nameCol < 0 && NAME_KEYS.some((k) => h.includes(k))) nameCol = i;
    if (priceCol < 0 && PRICE_KEYS.some((k) => h.includes(k))) priceCol = i;
  }
  return { nameCol, priceCol };
}

function inferPriceColumn(matrix: unknown[][], dataStartRow: number, width: number): number {
  let bestCol = -1;
  let bestScore = 0;
  const maxRow = Math.min(matrix.length, dataStartRow + 80);
  for (let c = 0; c < width; c++) {
    let nums = 0;
    for (let r = dataStartRow; r < maxRow; r++) {
      const row = matrix[r] ?? [];
      if (parsePrice(row[c]) > 0) nums += 1;
    }
    if (nums > bestScore) {
      bestScore = nums;
      bestCol = c;
    }
  }
  return bestScore >= 2 ? bestCol : -1;
}

function extractRowsWithHeaderRow(matrix: unknown[][], headerRowIdx: number): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  if (matrix.length <= headerRowIdx + 1) return out;

  const headerRow = matrix[headerRowIdx] ?? [];
  let { nameCol, priceCol } = detectColumnsFromHeader(headerRow);

  const width = Math.max(
    headerRow.length,
    ...matrix.slice(headerRowIdx, headerRowIdx + 5).map((r) => (Array.isArray(r) ? r.length : 0))
  );

  if (nameCol < 0) nameCol = 0;
  if (priceCol < 0) {
    priceCol = inferPriceColumn(matrix, headerRowIdx + 1, width);
  }
  if (priceCol < 0) return out;

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const name = String(row[nameCol] ?? '').trim();
    const price = parsePrice(row[priceCol]);
    if (!name || price <= 0) continue;
    if (name.length < 2) continue;
    out.push(normalizeRow(name, price, 'RUB'));
  }
  return out;
}

function extractRowsSmart(matrix: unknown[][]): NormalizedRow[] {
  const m = toMatrix(matrix);
  if (m.length < 2) return [];

  let best: NormalizedRow[] = [];
  const maxHeader = Math.min(28, m.length - 1);
  for (let h = 0; h < maxHeader; h++) {
    const rows = extractRowsWithHeaderRow(m, h);
    if (rows.length > best.length) best = rows;
  }
  return best;
}

async function parseWithExcelJs(buffer: Buffer): Promise<NormalizedRow[]> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    let best: NormalizedRow[] = [];
    for (const sheet of workbook.worksheets) {
      const rows: unknown[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row: { values: unknown[] }) => {
        rows.push((row.values ?? []).slice(1) as unknown[]);
      });
      const found = extractRowsSmart(rows);
      if (found.length > best.length) best = found;
    }
    return best;
  } catch {
    return [];
  }
}

function parseWithXlsx(buffer: Buffer): NormalizedRow[] {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    let best: NormalizedRow[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];
      const found = extractRowsSmart(matrix);
      if (found.length > best.length) best = found;
    }
    return best;
  } catch {
    return [];
  }
}
