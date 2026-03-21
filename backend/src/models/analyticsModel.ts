import { pool } from '../db/pool.js';
import * as anomaliesModel from './anomaliesModel.js';

export interface PriceHistoryPoint {
  date: string;
  price: number;
  document_id: string | null;
}

export interface PriceHistorySeries {
  supplier: { id: string; name: string };
  points: PriceHistoryPoint[];
}

export async function getPriceHistory(params: {
  organizationId: string;
  productId: string;
  dateFrom: Date;
  dateTo: Date;
  supplierId?: string | null;
}): Promise<{
  product: { id: string; name: string; unit: string | null };
  series: PriceHistorySeries[];
  stats: { min_price: number; max_price: number; avg_price: number; price_change_pct: number };
}> {
  const { rows: prod } = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM products WHERE id = $1::uuid AND organization_id = $2::uuid',
    [params.productId, params.organizationId]
  );
  if (!prod[0]) {
    const err = new Error('Product not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const dateFromStr = params.dateFrom.toISOString().slice(0, 10);
  const dateToStr = params.dateTo.toISOString().slice(0, 10);

  const supplierFilter = params.supplierId ? ' AND s.id = $5::uuid' : '';
  const queryParams: unknown[] = [
    params.productId,
    params.organizationId,
    dateFromStr,
    dateToStr,
  ];
  if (params.supplierId) queryParams.push(params.supplierId);

  const { rows } = await pool.query<{
    supplier_id: string;
    supplier_name: string;
    d: string;
    price: string;
    document_id: string | null;
  }>(
    `SELECT
       s.id AS supplier_id,
       s.name AS supplier_name,
       to_char(DATE(COALESCE(p.created_at, pl.created_at)), 'YYYY-MM-DD') AS d,
       p.price::text,
       p.document_id
     FROM prices p
     JOIN price_lists pl ON p.price_list_id = pl.id
     JOIN suppliers s ON pl.supplier_id = s.id
     WHERE p.product_id = $1::uuid
       AND pl.organization_id = $2::uuid
       AND DATE(COALESCE(p.created_at, pl.created_at)) BETWEEN $3::date AND $4::date${supplierFilter}
     ORDER BY COALESCE(p.created_at, pl.created_at) ASC`,
    queryParams
  );

  const bySupplier = new Map<string, { name: string; points: PriceHistoryPoint[] }>();
  const allPrices: number[] = [];
  const allPointsChrono: { t: number; price: number }[] = [];

  for (const r of rows) {
    const price = parseFloat(r.price);
    if (!Number.isFinite(price)) continue;
    allPrices.push(price);
    const t = new Date(r.d).getTime();
    allPointsChrono.push({ t, price });

    if (!bySupplier.has(r.supplier_id)) {
      bySupplier.set(r.supplier_id, { name: r.supplier_name, points: [] });
    }
    bySupplier.get(r.supplier_id)!.points.push({
      date: r.d,
      price,
      document_id: r.document_id,
    });
  }

  const series: PriceHistorySeries[] = [...bySupplier.entries()].map(([id, v]) => ({
    supplier: { id, name: v.name },
    points: v.points,
  }));

  const min_price = allPrices.length ? Math.min(...allPrices) : 0;
  const max_price = allPrices.length ? Math.max(...allPrices) : 0;
  const avg_price = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;

  allPointsChrono.sort((a, b) => a.t - b.t);
  let price_change_pct = 0;
  if (allPointsChrono.length >= 2) {
    const first = allPointsChrono[0]!.price;
    const last = allPointsChrono[allPointsChrono.length - 1]!.price;
    if (first !== 0) price_change_pct = ((last - first) / first) * 100;
  }

  return {
    product: { id: prod[0].id, name: prod[0].name, unit: null },
    series,
    stats: { min_price, max_price, avg_price, price_change_pct },
  };
}

export interface BestSupplierRow {
  supplier: { id: string; name: string };
  avg_price: number;
  min_price: number;
  delivery_count: number;
  price_stability: number;
  score: number;
}

export async function getBestSuppliers(params: {
  organizationId: string;
  productId?: string | null;
  periodDays: number;
}): Promise<{ suppliers: BestSupplierRow[] }> {
  const productFilter = params.productId ? ' AND p.product_id = $3::uuid' : '';
  const qParams: unknown[] = [params.organizationId, params.periodDays];
  if (params.productId) qParams.push(params.productId);

  const { rows } = await pool.query<{
    id: string;
    name: string;
    avg_price: string;
    min_price: string;
    delivery_count: string;
    price_stability: string;
  }>(
    `SELECT
       s.id,
       s.name,
       AVG(p.price)::text AS avg_price,
       MIN(p.price)::text AS min_price,
       COUNT(DISTINCT COALESCE(p.document_id::text, p.price_list_id::text))::text AS delivery_count,
       GREATEST(0::numeric,
         1::numeric - COALESCE(STDDEV_POP(p.price), 0)::numeric / NULLIF(AVG(p.price), 0)::numeric
       )::text AS price_stability
     FROM prices p
     JOIN price_lists pl ON p.price_list_id = pl.id
     JOIN suppliers s ON pl.supplier_id = s.id
     WHERE pl.organization_id = $1::uuid
       AND COALESCE(p.created_at, pl.created_at) >= NOW() - $2::int * INTERVAL '1 day'
       ${productFilter}
     GROUP BY s.id, s.name
     HAVING COUNT(*) > 0
     ORDER BY AVG(p.price) ASC`,
    qParams
  );

  const avgs = rows.map((r) => parseFloat(r.avg_price)).filter((x) => Number.isFinite(x));
  const minAvg = avgs.length ? Math.min(...avgs) : 0;
  const maxAvg = avgs.length ? Math.max(...avgs) : 0;
  const span = maxAvg - minAvg || 1;

  const suppliers: BestSupplierRow[] = rows.map((r) => {
    const avg_price = parseFloat(r.avg_price);
    const min_price = parseFloat(r.min_price);
    const delivery_count = parseInt(r.delivery_count, 10);
    const price_stability = Math.min(1, Math.max(0, parseFloat(r.price_stability) || 0));
    const priceScore =
      maxAvg === minAvg ? 50 : 50 * (1 - (avg_price - minAvg) / span);
    const score = Math.round(Math.min(100, Math.max(0, priceScore + price_stability * 50)));
    return {
      supplier: { id: r.id, name: r.name },
      avg_price,
      min_price,
      delivery_count,
      price_stability,
      score,
    };
  });

  suppliers.sort((a, b) => b.score - a.score);
  return { suppliers };
}

export interface SummaryProductChange {
  product: { id: string; name: string };
  change_pct: number;
  current_price: number;
}

export async function getPriceSummary(params: {
  organizationId: string;
  periodDays: number;
}): Promise<{
  top_growing: SummaryProductChange[];
  top_falling: SummaryProductChange[];
  anomalies_count: number;
  total_products_tracked: number;
}> {
  const { organizationId, periodDays } = params;

  const { rows: fl } = await pool.query<{
    product_id: string;
    name: string;
    first_price: string;
    last_price: string;
  }>(
    `WITH ordered AS (
       SELECT
         p.product_id,
         p.price,
         COALESCE(p.created_at, pl.created_at) AS ts
       FROM prices p
       JOIN price_lists pl ON p.price_list_id = pl.id
       WHERE pl.organization_id = $1::uuid
         AND COALESCE(p.created_at, pl.created_at) >= NOW() - $2::int * INTERVAL '1 day'
     ),
     first_p AS (
       SELECT DISTINCT ON (product_id) product_id, price AS first_price
       FROM ordered
       ORDER BY product_id, ts ASC
     ),
     last_p AS (
       SELECT DISTINCT ON (product_id) product_id, price AS last_price
       FROM ordered
       ORDER BY product_id, ts DESC
     )
     SELECT pr.id AS product_id, pr.name, f.first_price::text, l.last_price::text
     FROM first_p f
     INNER JOIN last_p l ON l.product_id = f.product_id AND f.first_price IS DISTINCT FROM l.last_price
     INNER JOIN products pr ON pr.id = f.product_id AND pr.organization_id = $1::uuid
     WHERE f.first_price > 0`,
    [organizationId, periodDays]
  );

  const changes: SummaryProductChange[] = [];
  for (const r of fl) {
    const fp = parseFloat(r.first_price);
    const lp = parseFloat(r.last_price);
    if (!Number.isFinite(fp) || !Number.isFinite(lp) || fp === 0) continue;
    const change_pct = ((lp - fp) / fp) * 100;
    changes.push({
      product: { id: r.product_id, name: r.name },
      change_pct,
      current_price: lp,
    });
  }

  const growing = [...changes].filter((c) => c.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct);
  const falling = [...changes].filter((c) => c.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct);

  const anomalies_count = await anomaliesModel.countAnomaliesInPeriod(organizationId, periodDays);

  const { rows: tc } = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT p.product_id)::text AS c
     FROM prices p
     JOIN price_lists pl ON p.price_list_id = pl.id
     WHERE pl.organization_id = $1::uuid
       AND COALESCE(p.created_at, pl.created_at) >= NOW() - $2::int * INTERVAL '1 day'`,
    [organizationId, periodDays]
  );
  const total_products_tracked = parseInt(tc[0]?.c ?? '0', 10);

  return {
    top_growing: growing.slice(0, 5),
    top_falling: falling.slice(0, 5),
    anomalies_count,
    total_products_tracked,
  };
}

/**
 * Price stability from a series of prices: GREATEST(0, 1 - STDDEV_POP/AVG) (same idea as best-suppliers SQL).
 * Pure math — no DB.
 */
export function calcPriceStability(prices: number[]): number {
  if (prices.length === 0) return 1;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (avg === 0) return 1;
  const n = prices.length;
  const variance = prices.reduce((s, p) => s + (p - avg) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const raw = 1 - std / avg;
  return Math.max(0, Math.min(1, raw));
}
