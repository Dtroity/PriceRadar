import { pool } from '../db/pool.js';

export interface ProductNameAlias {
  id: string;
  organization_id: string;
  raw_name: string;
  normalized_name: string;
  created_at: string;
}

export async function findByRawName(
  organizationId: string,
  rawName: string
): Promise<ProductNameAlias | null> {
  const { rows } = await pool.query<ProductNameAlias>(
    `SELECT id, organization_id, raw_name, normalized_name, created_at
     FROM product_aliases
     WHERE organization_id = $1 AND raw_name = $2
     LIMIT 1`,
    [organizationId, rawName.trim()]
  );
  return rows[0] ?? null;
}

export async function create(
  organizationId: string,
  rawName: string,
  normalizedName: string
): Promise<ProductNameAlias> {
  const { rows } = await pool.query<ProductNameAlias>(
    `INSERT INTO product_aliases (organization_id, raw_name, normalized_name)
     VALUES ($1, $2, $3)
     RETURNING id, organization_id, raw_name, normalized_name, created_at`,
    [organizationId, rawName.trim(), normalizedName.trim()]
  );
  return rows[0];
}

export async function ensure(
  organizationId: string,
  rawName: string,
  normalizedName: string
): Promise<ProductNameAlias> {
  const existing = await findByRawName(organizationId, rawName);
  if (existing) return existing;
  return create(organizationId, rawName, normalizedName);
}

export async function listForModeration(organizationId: string): Promise<Array<ProductNameAlias & { usage_count: number }>> {
  const { rows } = await pool.query<Array<ProductNameAlias & { usage_count: number }>[number]>(
    `SELECT
       pa.id,
       pa.organization_id,
       pa.raw_name,
       pa.normalized_name,
       pa.created_at,
       COALESCE(COUNT(di.id), 0)::int AS usage_count
     FROM product_aliases pa
     LEFT JOIN document_items di
       ON di.name = pa.raw_name
     LEFT JOIN documents d
       ON d.id = di.document_id AND d.organization_id = pa.organization_id
     WHERE pa.organization_id = $1
     GROUP BY pa.id
     ORDER BY usage_count DESC, pa.created_at DESC`,
    [organizationId]
  );
  return rows;
}

export async function bulkNormalize(
  organizationId: string,
  rawNames: string[],
  targetNormalizedName: string
): Promise<number> {
  const cleaned = rawNames.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length) return 0;
  const { rowCount } = await pool.query(
    `UPDATE product_aliases
     SET normalized_name = $1
     WHERE organization_id = $2 AND raw_name = ANY($3::text[])`,
    [targetNormalizedName.trim(), organizationId, cleaned]
  );
  return rowCount ?? 0;
}

