import ExcelJS from 'exceljs';
import { normalizeRow } from '../services/normalize.js';
/**
 * Parse Excel (XLS/XLSX) and extract product name + price columns.
 * Tries to auto-detect columns by headers (name, product, price, cost, etc.)
 */
export async function parseExcel(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const rows = [];
    const sheet = workbook.worksheets[0];
    if (!sheet)
        return rows;
    const data = sheet.getSheetValues();
    if (!data?.length)
        return rows;
    // First row as headers
    const headerRow = data[0]?.map((c) => String(c ?? '').toLowerCase()) ?? [];
    let nameCol = -1;
    let priceCol = -1;
    const nameKeys = ['name', 'product', 'товар', 'наименование', 'название', 'product name'];
    const priceKeys = ['price', 'cost', 'цена', 'стоимость', 'руб', 'sum'];
    for (let i = 0; i < headerRow.length; i++) {
        const h = headerRow[i];
        if (nameCol < 0 && nameKeys.some((k) => h.includes(k)))
            nameCol = i;
        if (priceCol < 0 && priceKeys.some((k) => h.includes(k)))
            priceCol = i;
    }
    // Fallback: first column = name, last numeric column = price
    if (nameCol < 0)
        nameCol = 0;
    if (priceCol < 0) {
        for (let c = headerRow.length - 1; c >= 0; c--) {
            const val = data[1]?.[c];
            if (typeof val === 'number' || (typeof val === 'string' && /[\d.,]+/.test(val))) {
                priceCol = c;
                break;
            }
        }
    }
    for (let r = 1; r < data.length; r++) {
        const row = data[r];
        if (!row)
            continue;
        const nameVal = row[nameCol];
        const priceVal = row[priceCol];
        const name = nameVal != null ? String(nameVal).trim() : '';
        if (!name)
            continue;
        let price = 0;
        if (typeof priceVal === 'number')
            price = priceVal;
        else if (typeof priceVal === 'string')
            price = parseFloat(priceVal.replace(/,/g, '.')) || 0;
        if (price <= 0)
            continue;
        rows.push(normalizeRow(name, price, 'RUB'));
    }
    return rows;
}
