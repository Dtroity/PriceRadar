import { normalizeRow } from '../services/normalize.js';
/**
 * Simple CSV parser (comma or semicolon separated).
 */
export function parseCsv(buffer) {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2)
        return [];
    const sep = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(sep).map((h) => h.toLowerCase().replace(/^["']|["']$/g, '').trim());
    const nameKeys = ['name', 'product', 'товар', 'наименование', 'название'];
    const priceKeys = ['price', 'cost', 'цена', 'стоимость', 'руб'];
    let nameCol = header.findIndex((h) => nameKeys.some((k) => h.includes(k)));
    let priceCol = header.findIndex((h) => priceKeys.some((k) => h.includes(k)));
    if (nameCol < 0)
        nameCol = 0;
    if (priceCol < 0)
        priceCol = header.length - 1;
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i], sep);
        const name = (parts[nameCol] ?? '').trim();
        if (!name)
            continue;
        const price = parseFloat(String(parts[priceCol] ?? '0').replace(/,/g, '.')) || 0;
        if (price <= 0)
            continue;
        rows.push(normalizeRow(name, price, 'RUB'));
    }
    return rows;
}
function parseCsvLine(line, sep) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        }
        else if (!inQuotes && c === sep) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += c;
        }
    }
    result.push(current.trim());
    return result;
}
