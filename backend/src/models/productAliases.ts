import { pool } from '../db/pool.js';

export interface ProductAlias {
  id: string;
  product_id: string;
  supplier_name: string;
  alias_name: string;
  confidence: number;
}

export async function findAlias(
  supplierName: string,
  aliasName: string,
  organizationId?: string
): Promise<ProductAlias | null> {
  if (organizationId) {
    const { rows } = await pool.query<ProductAlias>(
      `SELECT id, product_id, supplier_name, alias_name, confidence
       FROM product_aliases
       WHERE organization_id = $1 AND supplier_name = $2 AND alias_name = $3
       LIMIT 1`,
      [organizationId, supplierName.trim(), aliasName.trim()]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query<ProductAlias>(
    `SELECT id, product_id, supplier_name, alias_name, confidence
     FROM product_aliases
     WHERE supplier_name = $1 AND alias_name = $2
     LIMIT 1`,
    [supplierName.trim(), aliasName.trim()]
  );
  return rows[0] ?? null;
}

export async function findAliasesByNormalizedName(
  normalizedName: string
): Promise<ProductAlias[]> {
  const { rows } = await pool.query<ProductAlias>(
    `SELECT pa.id, pa.product_id, pa.supplier_name, pa.alias_name, pa.confidence
     FROM product_aliases pa
     JOIN products p ON p.id = pa.product_id
     WHERE p.normalized_name = $1`,
    [normalizedName]
  );
  return rows;
}

export async function createAlias(
  productId: string,
  supplierName: string,
  aliasName: string,
  confidence: number,
  organizationId?: string
): Promise<ProductAlias> {
  if (organizationId) {
    const { rows } = await pool.query<ProductAlias>(
      `INSERT INTO product_aliases (organization_id, product_id, supplier_name, alias_name, confidence)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, supplier_name, alias_name, confidence`,
      [organizationId, productId, supplierName.trim(), aliasName.trim(), confidence]
    );
    return rows[0];
  }
  const { rows } = await pool.query<ProductAlias>(
    `INSERT INTO product_aliases (product_id, supplier_name, alias_name, confidence)
     VALUES ($1, $2, $3, $4)
     RETURNING id, product_id, supplier_name, alias_name, confidence`,
    [productId, supplierName.trim(), aliasName.trim(), confidence]
  );
  return rows[0];
}

