import { pool } from '../../db/pool.js';
import * as productsModel from '../../models/products.js';
import * as productMetricsModel from '../../models/productMetrics.js';
import type { Product } from '../../types/index.js';

export type PriorityInputs = {
  usageCount: number;
  lastUsedAt: Date | null;
  priceStdDev: number;
  isFavorite: boolean;
};

/** Subscores 0–100; combined per product spec. Exported for unit tests. */
export function computePriorityScoreParts(input: PriorityInputs): {
  score: number;
  usage: number;
  recency: number;
  volatility: number;
  manual: number;
} {
  const usage = Math.min(input.usageCount / 50, 1) * 100;
  let recency = 0;
  if (input.lastUsedAt) {
    const days = (Date.now() - new Date(input.lastUsedAt).getTime()) / 86400000;
    recency = Math.exp(-days / 14) * 100;
  }
  const volatility =
    Number.isFinite(input.priceStdDev) && input.priceStdDev > 0
      ? Math.min(input.priceStdDev / 10, 1) * 100
      : 0;
  const manual = input.isFavorite ? 100 : 0;
  const score = usage * 0.4 + recency * 0.2 + volatility * 0.2 + manual * 0.2;
  return { score, usage, recency, volatility, manual };
}

export function calculatePriorityScore(input: PriorityInputs): number {
  return computePriorityScoreParts(input).score;
}

export async function updateProductMetrics(productId: string): Promise<void> {
  const product = await productsModel.getProductById(productId);
  if (!product?.organization_id) return;

  const std = await productMetricsModel.getPriceStdDev(productId, product.organization_id);
  const { rows: mrows } = await pool.query<{ usage_count: string | null; last_used_at: Date | null }>(
    `SELECT usage_count, last_used_at FROM product_metrics WHERE product_id = $1`,
    [productId]
  );
  const usageCount = mrows[0]?.usage_count != null ? parseInt(mrows[0].usage_count, 10) : 0;
  const lastUsedAt = mrows[0]?.last_used_at ?? null;

  const score = calculatePriorityScore({
    usageCount,
    lastUsedAt,
    priceStdDev: std,
    isFavorite: product.is_favorite ?? false,
  });

  await pool.query(
    `INSERT INTO product_metrics (product_id, organization_id, usage_count, last_used_at, price_std_dev, priority_score)
     SELECT $1::uuid, p.organization_id,
            COALESCE(m.usage_count, 0),
            m.last_used_at,
            $2::numeric,
            $3::numeric
     FROM products p
     LEFT JOIN product_metrics m ON m.product_id = p.id
     WHERE p.id = $1::uuid
     ON CONFLICT (product_id) DO UPDATE SET
       price_std_dev = EXCLUDED.price_std_dev,
       priority_score = EXCLUDED.priority_score,
       updated_at = NOW()`,
    [productId, std, score]
  );
}

export async function recordProductUsage(productId: string, organizationId: string): Promise<void> {
  await productMetricsModel.incrementUsage(productId, organizationId);
  await updateProductMetrics(productId);
}

export async function markAsFavorite(
  productId: string,
  value: boolean,
  organizationId: string
): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE products SET is_favorite = $2 WHERE id = $1 AND organization_id = $3`,
    [productId, value, organizationId]
  );
  if (!rowCount) {
    const err = new Error('Product not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  await updateProductMetrics(productId);
}

export async function getTopProducts(organizationId: string, limit = 50): Promise<Product[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.organization_id, p.name, p.normalized_name, p.is_priority, p.is_favorite, p.created_at,
            COALESCE(pm.usage_count, 0)::int AS usage_count,
            pm.last_used_at,
            COALESCE(pm.priority_score, 0)::float8 AS priority_score,
            COALESCE(pm.price_std_dev, 0)::float8 AS price_std_dev
     FROM products p
     LEFT JOIN product_metrics pm ON pm.product_id = p.id
     WHERE p.organization_id = $1
     ORDER BY COALESCE(pm.priority_score, 0) DESC, p.name ASC
     LIMIT $2`,
    [organizationId, limit]
  );
  return rows.map(mapProductRow);
}

const SEARCH_LIMIT = 200;

export async function searchProducts(organizationId: string, q: string): Promise<Product[]> {
  const term = q.trim();
  if (!term) {
    return productsModel.getAllProducts(organizationId);
  }
  const like = `%${term.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const { rows } = await pool.query(
    `SELECT p.id, p.organization_id, p.name, p.normalized_name, p.is_priority, p.is_favorite, p.created_at,
            COALESCE(pm.usage_count, 0)::int AS usage_count,
            pm.last_used_at,
            COALESCE(pm.priority_score, 0)::float8 AS priority_score,
            COALESCE(pm.price_std_dev, 0)::float8 AS price_std_dev,
            GREATEST(
              similarity(p.name, $2::text),
              similarity(COALESCE(p.normalized_name, ''), $2::text)
            ) AS trgm_rank
     FROM products p
     LEFT JOIN product_metrics pm ON pm.product_id = p.id
     WHERE p.organization_id = $1
       AND (
         p.name ILIKE $3 ESCAPE '\\'
         OR p.normalized_name ILIKE $3 ESCAPE '\\'
         OR p.name % $2::text
         OR COALESCE(p.normalized_name, '') % $2::text
       )
     ORDER BY
       trgm_rank DESC NULLS LAST,
       COALESCE(pm.priority_score, 0) DESC,
       p.name ASC
     LIMIT $4`,
    [organizationId, term, like, SEARCH_LIMIT]
  );
  return rows.map(mapProductRow);
}

function mapProductRow(r: Record<string, unknown>): Product {
  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    name: r.name as string,
    normalized_name: r.normalized_name as string,
    is_priority: r.is_priority as boolean,
    is_favorite: Boolean(r.is_favorite),
    created_at: r.created_at as Date,
    usage_count: r.usage_count != null ? Number(r.usage_count) : undefined,
    last_used_at: r.last_used_at != null ? (r.last_used_at as Date) : undefined,
    priority_score: r.priority_score != null ? Number(r.priority_score) : undefined,
    price_std_dev: r.price_std_dev != null ? Number(r.price_std_dev) : undefined,
  };
}

export async function recalculateAllScoresForOrganization(organizationId: string): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM products WHERE organization_id = $1`,
    [organizationId]
  );
  for (const r of rows) {
    await updateProductMetrics(r.id);
  }
  return rows.length;
}
