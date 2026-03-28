import { readFile } from 'fs/promises';
import XLSX from 'xlsx';

const LABEL_PREFIX =
  /^(поставщик|организация|контрагент|компания|продавец|исполнитель|наименование\s+организации)\s*[:]?\s*(.*)$/i;

const LEGAL_ENTITY = /^(ООО|ИП|АО|ПАО|ЗАО|НАО|АНО)\s+.{2,}/i;

function cleanSupplierName(s: string): string | null {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 200) return null;
  return t;
}

/**
 * Ищет в первых строках листа подписи «Поставщик» / «Организация» и значение в соседней ячейке или после двоеточия.
 */
export function extractSupplierFromExcelBuffer(buffer: Buffer): string | null {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];
      const hit = scanMatrixForSupplier(matrix.slice(0, 35));
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function scanMatrixForSupplier(rows: unknown[][]): string | null {
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').trim()).filter((c) => c.length > 0);
    if (cells.length === 0) continue;

    for (let i = 0; i < Math.min(row.length, 8); i++) {
      const a = String(row[i] ?? '').trim();
      const b = String(row[i + 1] ?? '').trim();
      const low = a.toLowerCase();
      const keys = [
        'поставщик',
        'организация',
        'контрагент',
        'компания',
        'продавец',
        'исполнитель',
        'наименование организации',
      ];
      for (const k of keys) {
        if (low === k || low === `${k}:`) {
          const v = cleanSupplierName(b);
          if (v) return v;
        }
        if (low.startsWith(`${k}:`)) {
          const rest = a.slice(a.indexOf(':') + 1).trim();
          const v = cleanSupplierName(rest);
          if (v) return v;
        }
      }
      const m = a.match(LABEL_PREFIX);
      if (m?.[2]) {
        const v = cleanSupplierName(m[2]);
        if (v) return v;
      }
    }

    for (const c of cells) {
      if (LEGAL_ENTITY.test(c)) {
        const v = cleanSupplierName(c);
        if (v) return v;
      }
    }
  }
  return null;
}

/**
 * Убирает типичный префикс «прайс-лист» из имени файла.
 */
export function inferSupplierFromFilename(originalName: string): string | null {
  const base = originalName.replace(/\.[^.]+$/i, '').replace(/_/g, ' ').trim();
  if (base.length < 3) return null;
  let s = base
    .replace(/^\s*прайс[\s-]*лист\s*/i, '')
    .replace(/^\s*price\s*list\s*/i, '')
    .trim();
  s = s.replace(/^[\s,.;:—–-]+/, '').trim();
  if (s.length < 3) return null;
  return s.length > 120 ? s.slice(0, 120) : s;
}

function sniffExcel(mimeType: string, originalName: string): boolean {
  const m = mimeType.toLowerCase();
  if (m.includes('spreadsheet') || m.includes('excel')) return true;
  return /\.xlsx?$/i.test(originalName);
}

function sniffCsv(mimeType: string, originalName: string): boolean {
  const m = mimeType.toLowerCase();
  if (m.includes('csv') || m.includes('text/plain')) return true;
  return /\.csv$/i.test(originalName);
}

export async function inferSupplierForPriceUpload(
  filePath: string,
  mimeType: string,
  originalName: string
): Promise<string | null> {
  if (sniffExcel(mimeType, originalName)) {
    try {
      const buf = await readFile(filePath);
      const fromSheet = extractSupplierFromExcelBuffer(buf);
      if (fromSheet) return fromSheet;
    } catch {
      /* fall through */
    }
  }

  if (sniffCsv(mimeType, originalName)) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const head = raw.slice(0, 4000);
      for (const line of head.split(/\r?\n/).slice(0, 25)) {
        const m = line.match(LABEL_PREFIX);
        if (m?.[2]) {
          const v = cleanSupplierName(m[2]);
          if (v) return v;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return inferSupplierFromFilename(originalName);
}
