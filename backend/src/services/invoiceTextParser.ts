import { completeJson } from '../ai/client.js';
import { parseInvoiceRules } from './invoiceRulesParser.js';
import { LLM_PARSE_CONFIDENCE_FALLBACK } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/** Structured invoice extraction after OCR (same shape as legacy AI service JSON). */
export interface ParsedInvoiceJson {
  supplier?: string | null;
  documentNumber?: string | null;
  date?: string | null;
  items?: Array<{
    name?: string | null;
    quantity?: number;
    unit?: string | null;
    price?: number | null;
    sum?: number | null;
    vat?: number | null;
  }>;
  total?: number | null;
  confidence?: number | null;
  source?: 'llm' | 'rules';
}

const INVOICE_PROMPT = `Extract from the following invoice/receipt text into JSON only. No markdown, no explanation.
Output exactly this JSON structure (use null for missing):
{"supplier": "company name or null", "documentNumber": "number or null", "date": "YYYY-MM-DD or null", "total": number or null, "confidence": number between 0 and 1, "items": [{"name": "product name", "quantity": number, "unit": "kg/l/pcs or null", "price": number, "sum": number, "vat": number or null}, ...]}

Text:
`.trim();

function rulesToParsedJson(r: ReturnType<typeof parseInvoiceRules>): ParsedInvoiceJson {
  return {
    supplier: r.supplier ?? null,
    documentNumber: r.documentNumber ?? null,
    date: r.date ?? null,
    items: r.items.map((it) => ({
      name: it.name,
      quantity: it.quantity ?? 0,
      unit: it.unit ?? null,
      price: it.price ?? null,
      sum:
        it.price != null && it.quantity != null && Number.isFinite(it.price * it.quantity)
          ? it.price * it.quantity
          : null,
      vat: null,
    })),
    total: r.total ?? null,
    confidence: r.confidence,
    source: 'rules',
  };
}

/**
 * LLM structured parse with rules fallback (OpenAI or Ollama via existing ai/client).
 */
export async function parseInvoiceFromText(ocrText: string): Promise<ParsedInvoiceJson> {
  const trimmed = ocrText.trim();
  if (!trimmed) {
    return {
      supplier: null,
      documentNumber: null,
      date: null,
      items: [],
      total: null,
      confidence: 0.5,
      source: 'rules',
    };
  }

  try {
    const prompt = `${INVOICE_PROMPT}\n"""${trimmed.slice(0, 12000)}"""`;
    const obj = await completeJson<ParsedInvoiceJson>(prompt);
    const items = Array.isArray(obj.items) ? obj.items : [];
    let confidence =
      typeof obj.confidence === 'number' && !Number.isNaN(obj.confidence) ? obj.confidence : 0.85;
    if (!items.length && !obj.supplier) {
      confidence = Math.min(confidence, 0.45);
    }

    if (confidence < LLM_PARSE_CONFIDENCE_FALLBACK) {
      const reason = `LLM confidence ${confidence} < ${LLM_PARSE_CONFIDENCE_FALLBACK}`;
      logger.warn({ msg: '[Parser] LLM failed, falling back to rules parser', reason });
      return rulesToParsedJson(parseInvoiceRules(trimmed));
    }

    return {
      supplier: obj.supplier ?? null,
      documentNumber: obj.documentNumber ?? null,
      date: obj.date ?? null,
      items,
      total: obj.total ?? null,
      confidence: items.length || obj.supplier ? confidence : 0.5,
      source: 'llm',
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn({ msg: '[Parser] LLM failed, falling back to rules parser', reason });
    try {
      return rulesToParsedJson(parseInvoiceRules(trimmed));
    } catch (e2) {
      logger.error({ err: e2, msg: '[Parser] Rules parser failed after LLM error' });
      return {
        supplier: null,
        documentNumber: null,
        date: null,
        items: [],
        total: null,
        confidence: 0.35,
        source: 'rules',
      };
    }
  }
}
