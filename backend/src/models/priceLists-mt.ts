import { pool } from '../db/pool.js';
import type { PriceList, SourceType } from '../types/index.js';

export async function create(
  organizationId: string,
  supplierId: string,
  uploadDate: Date,
  sourceType: SourceType,
  filePath: string | null
): Promise<PriceList> {
  const { rows } = await pool.query(
    `INSERT INTO price_lists (organization_id, supplier_id, upload_date, source_type, file_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, supplier_id, upload_date, source_type, file_path, created_at`,
    [organizationId, supplierId, uploadDate, sourceType, filePath]
  );
  return rows[0];
}

export async function getPrevious(
  organizationId: string,
  supplierId: string,
  beforeDate: Date
): Promise<PriceList | null> {
  const { rows } = await pool.query(
    `SELECT id, supplier_id, upload_date, source_type, file_path, created_at
     FROM price_lists WHERE organization_id = $1 AND supplier_id = $2 AND upload_date < $3
     ORDER BY upload_date DESC LIMIT 1`,
    [organizationId, supplierId, beforeDate]
  );
  return rows[0] ?? null;
}
