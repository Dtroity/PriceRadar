import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import { normalizeRow } from '../services/normalize.js';
/**
 * Parse Excel (XLS/XLSX) and extract product name + price columns.
 * Tries to auto-detect columns by headers (name, product, price, cost, etc.)
 */
export async function parseExcel(buffer) {
    const fromExcelJs = await parseWithExcelJs(buffer);
    if (fromExcelJs.length > 0)
        return fromExcelJs;
    return parseWithXlsx(buffer);
}
function parsePrice(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/\s+/g, '').replace(',', '.');
        return parseFloat(normalized) || 0;
    }
    return 0;
}
function toMatrix(rows) {
    return rows
        .map((row) => (Array.isArray(row) ? row : []))
        .filter((row) => row.some((v) => String(v ?? '').trim() !== ''));
}
function extractRows(matrix) {
    const out = [];
    if (matrix.length === 0)
        return out;
    const header = (matrix[0] ?? []).map((c) => String(c ?? '').toLowerCase());
    let nameCol = -1;
    let priceCol = -1;
    const nameKeys = ['name', 'product', 'товар', 'наименование', 'название', 'product name'];
    const priceKeys = ['price', 'cost', 'цена', 'стоимость', 'руб', 'sum'];
    for (let i = 0; i < header.length; i++) {
        const h = header[i] ?? '';
        if (nameCol < 0 && nameKeys.some((k) => h.includes(k)))
            nameCol = i;
        if (priceCol < 0 && priceKeys.some((k) => h.includes(k)))
            priceCol = i;
    }
    if (nameCol < 0)
        nameCol = 0;
    if (priceCol < 0) {
        const probe = matrix[1] ?? [];
        for (let c = Math.max(probe.length, header.length) - 1; c >= 0; c--) {
            if (parsePrice(probe[c]) > 0) {
                priceCol = c;
                break;
            }
        }
    }
    if (priceCol < 0)
        return out;
    for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r] ?? [];
        const name = String(row[nameCol] ?? '').trim();
        const price = parsePrice(row[priceCol]);
        if (!name || price <= 0)
            continue;
        out.push(normalizeRow(name, price, 'RUB'));
    }
    return out;
}
async function parseWithExcelJs(buffer) {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        if (!sheet)
            return [];
        const rows = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
            rows.push((row.values ?? []).slice(1));
        });
        return extractRows(toMatrix(rows));
    }
    catch {
        return [];
    }
}
function parseWithXlsx(buffer) {
    try {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const firstName = wb.SheetNames[0];
        if (!firstName)
            return [];
        const sheet = wb.Sheets[firstName];
        if (!sheet)
            return [];
        const matrix = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
        });
        return extractRows(toMatrix(matrix));
    }
    catch {
        return [];
    }
}
