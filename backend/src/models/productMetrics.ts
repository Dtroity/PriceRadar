import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

export interface ProductMetricsRow {
  product_id: string;
  organization_id: string;
  usage_count: number;
  last_used_at: Date | null;
  price_std_dev: string;
  priority_score: string;
}

export async function getPriceStdDev(productId: string, organizationId: string): Promise<number> {
  const { rows } = await pool.query<{ s: string | null }>(
    `SELECT STDDEV_SAMP(p.price::double precision) AS s
     FROM prices p
     INNER JOIN price_lists pl ON pl.id = p.price_list_id
     WHERE p.product_id = $1 AND pl.organization_id = $2`,
    [productId, organizationId]
  );
  const v = rows[0]?.s != null ? parseFloat(rows[0].s) : NaN;
  return Number.isFinite(v) ? v : 0;
}

/** Lazy insert then increment usage + touch last_used_at */
export async function incrementUsage(productId: string, organizationId: string): Promise<void> {
  await pool.query(
    `INSERT INTO product_metrics (product_id, organization_id, usage_count, last_used_at, price_std_dev, priority_score)
     VALUES ($1, $2, 1, NOW(), 0, 0)
     ON CONFLICT (product_id) DO UPDATE SET
       usage_count = product_metrics.usage_count + 1,
       last_used_at = NOW(),
       updated_at = NOW()`,
    [productId, organizationId]
  );
}

export async function mergeMetricsForProductMerge(
  client: PoolClient,
  organizationId: string,
  targetProductId: string,
  sourceProductIds: string[]
): Promise<void> {
  if (sourceProductIds.length === 0) return;
  const allIds = [targetProductId, ...sourceProductIds];
  const { rows } = await client.query<{ u: string | null; lu: Date | null }>(
    `SELECT
       COALESCE(SUM(usage_count), 0)::text AS u,
       MAX(last_used_at) AS lu
     FROM product_metrics
     WHERE product_id = ANY($1::uuid[])`,
    [allIds]
  );
  const usage = rows[0]?.u != null ? parseInt(rows[0].u, 10) : 0;
  const lastUsed = rows[0]?.lu ?? null;

  await client.query(
    `INSERT INTO product_metrics (product_id, organization_id, usage_count, last_used_at, price_std_dev, priority_score)
     VALUES ($1::uuid, $2::uuid, $3::int, $4, 0, 0)
     ON CONFLICT (product_id) DO UPDATE SET
       usage_count = EXCLUDED.usage_count,
       last_used_at = CASE
         WHEN product_metrics.last_used_at IS NULL THEN EXCLUDED.last_used_at
         WHEN EXCLUDED.last_used_at IS NULL THEN product_metrics.last_used_at
         ELSE GREATEST(product_metrics.last_used_at, EXCLUDED.last_used_at)
       END,
       updated_at = NOW()`,
    [targetProductId, organizationId, usage, lastUsed]
  );

  await client.query(`DELETE FROM product_metrics WHERE product_id = ANY($1::uuid[])`, [sourceProductIds]);
}

export async function listOrganizationIds(): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at`);
  return rows.map((r) => r.id);
}
