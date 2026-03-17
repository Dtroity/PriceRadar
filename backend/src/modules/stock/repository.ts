import { pool } from '../../db/pool.js';
import type { MovementType } from './types.js';

export async function getOrCreateStock(organizationId: string, productId: string, unit = 'kg') {
  const { rows: existing } = await pool.query(
    `SELECT id, organization_id, product_id, current_stock, unit, updated_at
     FROM product_stock WHERE organization_id = $1 AND product_id = $2`,
    [organizationId, productId]
  );
  if (existing[0]) return existing[0];
  await pool.query(
    `INSERT INTO product_stock (organization_id, product_id, current_stock, unit)
     VALUES ($1, $2, 0, $3) ON CONFLICT (organization_id, product_id) DO NOTHING`,
    [organizationId, productId, unit]
  );
  const { rows } = await pool.query(
    `SELECT id, organization_id, product_id, current_stock, unit, updated_at
     FROM product_stock WHERE organization_id = $1 AND product_id = $2`,
    [organizationId, productId]
  );
  return rows[0];
}

export async function addStock(
  organizationId: string,
  productId: string,
  quantity: number,
  movementType: MovementType,
  source: string | null
) {
  await pool.query(
    `INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, source)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, productId, quantity, movementType, source]
  );
  const st = await getOrCreateStock(organizationId, productId);
  await pool.query(
    `UPDATE product_stock SET current_stock = current_stock + $3, updated_at = NOW()
     WHERE organization_id = $1 AND product_id = $2`,
    [organizationId, productId, quantity]
  );
  const { rows } = await pool.query(
    `SELECT id, organization_id, product_id, current_stock, unit, updated_at
     FROM product_stock WHERE organization_id = $1 AND product_id = $2`,
    [organizationId, productId]
  );
  return rows[0];
}

export async function listStock(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT p.id AS product_id, p.name AS product_name,
       COALESCE(ps.current_stock, 0) AS current_stock,
       ps.unit, ps.updated_at
     FROM products p
     LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.organization_id = p.organization_id
     WHERE p.organization_id = $1 ORDER BY p.name`,
    [organizationId]
  );
  return rows;
}

export async function getMovements(organizationId: string, productId?: string, limit = 100) {
  let q = `SELECT id, organization_id, product_id, quantity, movement_type, source, created_at
           FROM stock_movements WHERE organization_id = $1`;
  const params: unknown[] = [organizationId];
  if (productId) {
    params.push(productId);
    q += ` AND product_id = $2`;
  }
  q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function getDailyConsumptionFromMovements(organizationId: string, productId: string, days = 14): Promise<number> {
  const { rows } = await pool.query(
    `SELECT SUM(CASE WHEN movement_type = 'recipe_usage' THEN -quantity ELSE 0 END) AS out_qty,
            SUM(CASE WHEN movement_type = 'invoice' THEN quantity ELSE 0 END) AS in_qty
     FROM stock_movements
     WHERE organization_id = $1 AND product_id = $2 AND created_at >= NOW() - INTERVAL '1 day' * $3`,
    [organizationId, productId, days]
  );
  const r = rows[0];
  const netOut = (Number(r?.out_qty) || 0) - (Number(r?.in_qty) || 0);
  return days > 0 ? Math.max(0, -netOut) / days : 0;
}

export async function getConsumptionFromRecipeUsage(organizationId: string, productId: string, days = 14): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ABS(quantity)), 0) AS total
     FROM stock_movements
     WHERE organization_id = $1 AND product_id = $2 AND movement_type = 'recipe_usage'
       AND created_at >= NOW() - INTERVAL '1 day' * $3`,
    [organizationId, productId, days]
  );
  const total = Number(rows[0]?.total ?? 0);
  return days > 0 ? total / days : 0;
}
