import { pool } from '../db/pool.js';
import type { Document, DocumentItem, DocumentStatus } from '../types/index.js';

const DOCUMENT_SELECT = `id, organization_id, supplier_id, supplier_name, document_number, document_date, file_path, source_type, status, confidence, ocr_confidence, ocr_engine, parse_source, total_amount, created_at, updated_at`;

export async function create(
  organizationId: string,
  filePath: string,
  sourceType: string,
  supplierId?: string | null,
  supplierName?: string | null
): Promise<Document> {
  const { rows } = await pool.query(
    `INSERT INTO documents (organization_id, file_path, source_type, supplier_id, supplier_name, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING ${DOCUMENT_SELECT}`,
    [organizationId, filePath, sourceType, supplierId ?? null, supplierName ?? null]
  );
  return rows[0];
}

export type ParsedUpdate = {
  supplier_id?: string | null;
  supplier_name?: string | null;
  document_number?: string | null;
  document_date?: string | null;
  total_amount?: number | null;
  status?: DocumentStatus;
  confidence?: number | null;
  ocr_confidence?: number | null;
  ocr_engine?: string | null;
  parse_source?: string | null;
};

/** Partial patch (only defined keys). Uses COALESCE — do not use to intentionally set NULL. */
export async function updateParsed(
  id: string,
  organizationId: string,
  data: ParsedUpdate
): Promise<Document | null> {
  const { rows } = await pool.query(
    `UPDATE documents SET
       supplier_id = COALESCE($2, supplier_id),
       supplier_name = COALESCE($3, supplier_name),
       document_number = COALESCE($4, document_number),
       document_date = COALESCE($5, document_date),
       total_amount = COALESCE($6, total_amount),
       status = COALESCE($7, status),
       confidence = COALESCE($8, confidence),
       ocr_confidence = COALESCE($9, ocr_confidence),
       ocr_engine = COALESCE($10, ocr_engine),
       parse_source = COALESCE($11, parse_source),
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $12
     RETURNING ${DOCUMENT_SELECT}`,
    [
      id,
      data.supplier_id,
      data.supplier_name,
      data.document_number,
      data.document_date,
      data.total_amount,
      data.status ?? null,
      data.confidence ?? null,
      data.ocr_confidence ?? null,
      data.ocr_engine ?? null,
      data.parse_source ?? null,
      organizationId,
    ]
  );
  return rows[0] ?? null;
}

/** Full write after successful invoice parse (allows NULL supplier fields). */
export async function setInvoiceParseResult(
  id: string,
  organizationId: string,
  data: {
    supplier_name: string | null;
    document_number: string | null;
    document_date: string | null;
    total_amount: number | null;
    status: DocumentStatus;
    confidence: number | null;
    ocr_confidence: number;
    ocr_engine: string;
    parse_source: string | null;
  }
): Promise<Document | null> {
  const { rows } = await pool.query(
    `UPDATE documents SET
       supplier_name = $2,
       document_number = $3,
       document_date = $4,
       total_amount = $5,
       status = $6,
       confidence = $7,
       ocr_confidence = $8,
       ocr_engine = $9,
       parse_source = $10,
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $11
     RETURNING ${DOCUMENT_SELECT}`,
    [
      id,
      data.supplier_name,
      data.document_number,
      data.document_date,
      data.total_amount,
      data.status,
      data.confidence,
      data.ocr_confidence,
      data.ocr_engine,
      data.parse_source,
      organizationId,
    ]
  );
  return rows[0] ?? null;
}

/** Low OCR confidence: no structured parse, clear invoice fields */
export async function markOcrFailed(
  id: string,
  organizationId: string,
  ocrConfidence: number,
  ocrEngine: string
): Promise<Document | null> {
  const { rows } = await pool.query(
    `UPDATE documents SET
       status = 'ocr_failed',
       ocr_confidence = $2,
       ocr_engine = $3,
       supplier_name = NULL,
       document_number = NULL,
       document_date = NULL,
       total_amount = NULL,
       confidence = NULL,
       parse_source = NULL,
       updated_at = NOW()
     WHERE id = $1 AND organization_id = $4
     RETURNING ${DOCUMENT_SELECT}`,
    [id, ocrConfidence, ocrEngine, organizationId]
  );
  return rows[0] ?? null;
}

export async function getById(id: string, organizationId: string): Promise<Document | null> {
  const { rows } = await pool.query(
    `SELECT ${DOCUMENT_SELECT}
     FROM documents WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function list(
  organizationId: string,
  filters: { status?: DocumentStatus } = {},
  limit = 50
): Promise<Document[]> {
  let query = `SELECT ${DOCUMENT_SELECT} FROM documents WHERE organization_id = $1`;
  const params: unknown[] = [organizationId];
  if (filters.status) {
    params.push(filters.status);
    query += ` AND status = $${params.length}`;
  }
  query += ` ORDER BY created_at DESC LIMIT ${limit}`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function deleteItems(documentId: string): Promise<void> {
  await pool.query('DELETE FROM document_items WHERE document_id = $1', [documentId]);
}

export async function insertItems(
  documentId: string,
  items: Array<{
    line_index: number;
    name: string | null;
    quantity: number;
    unit: string | null;
    price: number | null;
    sum: number | null;
    vat: number | null;
    needs_review?: boolean;
  }>
): Promise<void> {
  if (items.length === 0) return;
  for (const it of items) {
    await pool.query(
      `INSERT INTO document_items (document_id, line_index, name, quantity, unit, price, sum, vat, needs_review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        documentId,
        it.line_index,
        it.name,
        it.quantity,
        it.unit,
        it.price,
        it.sum,
        it.vat,
        it.needs_review ?? false,
      ]
    );
  }
}

export async function getItems(documentId: string): Promise<DocumentItem[]> {
  const { rows } = await pool.query(
    `SELECT id, document_id, line_index, name, quantity, unit, price, sum, vat, product_id, needs_review, created_at
     FROM document_items WHERE document_id = $1 ORDER BY line_index`,
    [documentId]
  );
  return rows;
}

export async function updateItemProduct(
  itemId: string,
  documentId: string,
  productId: string | null
): Promise<void> {
  await pool.query(
    'UPDATE document_items SET product_id = $1 WHERE id = $2 AND document_id = $3',
    [productId, itemId, documentId]
  );
}

export async function updateItem(
  itemId: string,
  documentId: string,
  organizationId: string,
  data: {
    name?: string | null;
    quantity?: number;
    unit?: string | null;
    price?: number | null;
    sum?: number | null;
    vat?: number | null;
    product_id?: string | null;
    needs_review?: boolean;
  }
): Promise<void> {
  const doc = await getById(documentId, organizationId);
  if (!doc) return;
  await pool.query(
    `UPDATE document_items SET
       name = COALESCE($2, name),
       quantity = COALESCE($3, quantity),
       unit = COALESCE($4, unit),
       price = COALESCE($5, price),
       sum = COALESCE($6, sum),
       vat = COALESCE($7, vat),
       product_id = COALESCE($8, product_id),
       needs_review = COALESCE($9, needs_review)
     WHERE id = $1 AND document_id = $10`,
    [
      itemId,
      data.name,
      data.quantity,
      data.unit,
      data.price,
      data.sum,
      data.vat,
      data.product_id,
      data.needs_review,
      documentId,
    ]
  );
}

export async function saveAiFeedback(
  organizationId: string,
  documentItemId: string,
  originalText: string,
  correctedText: string,
  productId: string | null
): Promise<void> {
  const { rowCount } = await pool.query(
    `INSERT INTO ai_feedback (organization_id, document_item_id, original_text, corrected_text, product_id)
     SELECT d.organization_id, di.id, $3, $4, $5
     FROM document_items di
     JOIN documents d ON d.id = di.document_id
     WHERE di.id = $2 AND d.organization_id = $1`,
    [organizationId, documentItemId, originalText, correctedText, productId]
  );
  if (rowCount === 0) throw new Error('Document item not found or wrong organization');
}
