/**
 * Heuristic RU invoice / УПД line parser when LLM is unavailable or low confidence.
 */

export interface ParsedInvoice {
  supplier?: string;
  documentNumber?: string;
  date?: string;
  items: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    price?: number;
  }>;
  total?: number;
  confidence: number;
  source: 'llm' | 'rules';
}

const DATE_RE = /\b(\d{2}[.\-/]\d{2}[.\-/]\d{2,4})\b/;
const DOC_NUM_RE = /(?:№|N|No\.?|накладн\w*)[\s#]*([\w\-/]+)/i;
const TOTAL_RE = /(?:итого|всего|total)[:\s]+(\d+[,.]?\d*)/gi;
const LINE_RE =
  /^(.+?)\s+(\d+[,.]?\d*)\s+(\w+(?:\/\w+)?|шт|кг|л|мл|упак)\s+(\d+[,.]?\d*)\s*$/i;

function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function normalizeDate(raw: string): string | undefined {
  const m = raw.match(DATE_RE);
  if (!m) return undefined;
  const parts = m[1].split(/[.\-/]/);
  if (parts.length < 3) return m[1];
  let [d, mo, y] = parts;
  if (y.length === 2) y = `20${y}`;
  if (d && mo && y) return `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return m[1];
}

function guessSupplier(lines: string[]): string | undefined {
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i].trim();
    if (/^(ИП|ООО|АО|ПАО|ЗАО)\b/i.test(l)) return l.slice(0, 255);
  }
  return undefined;
}

export function parseInvoiceRules(ocrText: string): ParsedInvoice {
  const text = ocrText.trim();
  if (!text) {
    return { items: [], confidence: 0.2, source: 'rules' };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const date = normalizeDate(text);
  let documentNumber: string | undefined;
  const dm = text.match(DOC_NUM_RE);
  if (dm) documentNumber = dm[1];

  const supplier = guessSupplier(lines);

  const items: ParsedInvoice['items'] = [];
  for (const line of lines) {
    if (line.length < 5) continue;
    if (/итого|всего|total|сумма/i.test(line) && !LINE_RE.test(line)) continue;
    const lm = line.match(LINE_RE);
    if (lm) {
      const name = lm[1].trim();
      const qty = parseNum(lm[2]);
      const unit = lm[3].trim();
      const price = parseNum(lm[4]);
      if (name && Number.isFinite(price)) {
        items.push({
          name,
          quantity: Number.isFinite(qty) ? qty : undefined,
          unit,
          price,
        });
      }
    }
  }

  let total: number | undefined;
  let lastTotal: RegExpExecArray | null = null;
  TOTAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOTAL_RE.exec(text)) !== null) lastTotal = m;
  if (lastTotal) {
    const t = parseNum(lastTotal[1]);
    if (Number.isFinite(t)) total = t;
  }

  let confidence = 0.45;
  if (items.length >= 2) confidence += 0.15;
  if (date) confidence += 0.1;
  if (supplier) confidence += 0.1;
  if (documentNumber) confidence += 0.1;
  if (total != null) confidence += 0.05;
  confidence = Math.min(0.85, confidence);

  return {
    supplier,
    documentNumber,
    date,
    items,
    total,
    confidence,
    source: 'rules',
  };
}
