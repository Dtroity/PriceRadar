import { pool } from '../db/pool.js';
import type { PriceList, SourceType } from '../types/index.js';

export async function createPriceList(
  supplierId: string,
  uploadDate: Date,
  sourceType: SourceType,
  filePath: string | null,
  organizationId?: string
): Promise<PriceList> {
  if (!organizationId) {
    throw new Error('createPriceList: organizationId is required');
  }
  const { rows } = await pool.query(
    `INSERT INTO price_lists (organization_id, supplier_id, upload_date, source_type, file_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, supplier_id, upload_date, source_type, file_path, created_at`,
    [organizationId, supplierId, uploadDate, sourceType, filePath]
  );
  return rows[0];
}

export async function getLatestPriceListBySupplier(supplierId: string): Promise<PriceList | null> {
  const { rows } = await pool.query(
    `SELECT id, supplier_id, upload_date, source_type, file_path, created_at
     FROM price_lists WHERE supplier_id = $1
     ORDER BY upload_date DESC, created_at DESC LIMIT 1`,
    [supplierId]
  );
  return rows[0] ?? null;
}

export async function getPriceListById(priceListId: string): Promise<{ id: string; supplier_id: string; organization_id?: string; upload_date: Date } | null> {
  const { rows } = await pool.query(
    `SELECT id, supplier_id, organization_id, upload_date FROM price_lists WHERE id = $1`,
    [priceListId]
  );
  return rows[0] ?? null;
}

export async function getPreviousPriceList(
  supplierId: string,
  beforeDate: Date,
  organizationId?: string
): Promise<PriceList | null> {
  if (organizationId) {
    const { rows } = await pool.query(
      `SELECT id, supplier_id, upload_date, source_type, file_path, created_at
       FROM price_lists WHERE organization_id = $1 AND supplier_id = $2 AND upload_date < $3
       ORDER BY upload_date DESC LIMIT 1`,
      [organizationId, supplierId, beforeDate]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query(
    `SELECT id, supplier_id, upload_date, source_type, file_path, created_at
     FROM price_lists WHERE supplier_id = $1 AND upload_date < $2
     ORDER BY upload_date DESC LIMIT 1`,
    [supplierId, beforeDate]
  );
  return rows[0] ?? null;
}
