import { parseExcel } from './excelParser.js';
import { parseCsv } from './csvParser.js';
export async function parseBuffer(buffer, mimeType, filename) {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        ext === 'xls' ||
        ext === 'xlsx') {
        return parseExcel(buffer);
    }
    if (mimeType.includes('csv') || ext === 'csv') {
        return parseCsv(buffer);
    }
    if (mimeType.includes('pdf') || ext === 'pdf') {
        return parsePdf(buffer);
    }
    if (mimeType.includes('word') ||
        mimeType.includes('document') ||
        ext === 'doc' ||
        ext === 'docx') {
        return parseDoc(buffer);
    }
    // For images (JPG, PNG, HEIC) we would use OCR - stub for MVP
    return [];
}
async function parsePdf(buffer) {
    try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        return parseTextToRows(data.text);
    }
    catch {
        return [];
    }
}
async function parseDoc(buffer) {
    try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return parseTextToRows(result.value);
    }
    catch {
        return [];
    }
}
import { normalizeRow } from '../services/normalize.js';
function parseTextToRows(text) {
    const rows = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines) {
        // Try pattern: "Name ... 123.45" or "Name\t123.45"
        const match = line.match(/^(.+?)\s+(\d+[\.,]\d{2})\s*$/);
        if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2].replace(',', '.')) || 0;
            if (name && price > 0)
                rows.push(normalizeRow(name, price, 'RUB'));
        }
    }
    return rows;
}
export { parseExcel, parseCsv };
