import { pool } from '../db/pool.js';

export type SupplierFilterRow = {
  id: string;
  keyword: string;
};

export async function listFiltersBySupplier(params: {
  organizationId: string;
  supplierId: string;
}): Promise<SupplierFilterRow[]> {
  const { rows } = await pool.query<SupplierFilterRow>(
    `
    SELECT f.id, f.keyword
    FROM supplier_filters f
    JOIN suppliers s ON s.id = f.supplier_id
    WHERE f.supplier_id = $1::uuid AND s.organization_id = $2::uuid
    ORDER BY f.keyword ASC
    `,
    [params.supplierId, params.organizationId]
  );
  return rows;
}

export async function createFilter(params: {
  organizationId: string;
  supplierId: string;
  keyword: string;
}): Promise<SupplierFilterRow> {
  const kw = params.keyword.trim();
  const { rows } = await pool.query<SupplierFilterRow>(
    `
    INSERT INTO supplier_filters (organization_id, supplier_id, keyword)
    SELECT $1::uuid, $2::uuid, $3
    WHERE EXISTS (
      SELECT 1 FROM suppliers s WHERE s.id = $2::uuid AND s.organization_id = $1::uuid
    )
    ON CONFLICT (supplier_id, keyword) DO UPDATE SET keyword = EXCLUDED.keyword
    RETURNING id, keyword
    `,
    [params.organizationId, params.supplierId, kw]
  );
  if (!rows[0]) throw new Error('Supplier not found');
  return rows[0];
}

export async function deleteFilter(params: {
  organizationId: string;
  supplierId: string;
  filterId: string;
}): Promise<boolean> {
  const { rowCount } = await pool.query(
    `
    DELETE FROM supplier_filters f
    USING suppliers s
    WHERE f.id = $1::uuid
      AND f.supplier_id = $2::uuid
      AND s.id = f.supplier_id
      AND s.organization_id = $3::uuid
    `,
    [params.filterId, params.supplierId, params.organizationId]
  );
  return (rowCount ?? 0) > 0;
}

