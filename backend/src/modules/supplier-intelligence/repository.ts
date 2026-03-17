import { pool } from '../../db/pool.js';

export async function getSupplierPriceStats(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT supplier_id, product_id,
       AVG(price)::numeric(12,2) AS avg_price,
       COUNT(*) AS data_points,
       STDDEV(price)::numeric(12,4) AS price_stddev
     FROM supplier_prices_history
     WHERE organization_id = $1 AND date >= CURRENT_DATE - INTERVAL '90 days'
     GROUP BY supplier_id, product_id`,
    [organizationId]
  );
  return rows;
}

export async function getSupplierProductCount(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT supplier_id, COUNT(DISTINCT product_id) AS product_count
     FROM supplier_prices_history
     WHERE organization_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY supplier_id`,
    [organizationId]
  );
  return rows;
}

export async function upsertSupplierScore(
  supplierId: string,
  organizationId: string,
  priceScore: number,
  stabilityScore: number,
  availabilityScore: number,
  totalScore: number
) {
  await pool.query(
    `INSERT INTO supplier_score (supplier_id, organization_id, price_score, stability_score, availability_score, total_score, calculated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (supplier_id, organization_id) DO UPDATE SET
       price_score = $3, stability_score = $4, availability_score = $5, total_score = $6, calculated_at = NOW()`,
    [supplierId, organizationId, priceScore, stabilityScore, availabilityScore, totalScore]
  );
}

export async function getCurrentPricesByProduct(organizationId: string, productId: string) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (pl.supplier_id) pl.supplier_id, pr.price, s.name AS supplier_name
     FROM prices pr
     JOIN price_lists pl ON pl.id = pr.price_list_id
     JOIN suppliers s ON s.id = pl.supplier_id
     WHERE pl.organization_id = $1 AND pr.product_id = $2
     ORDER BY pl.supplier_id, pl.upload_date DESC, pl.created_at DESC`,
    [organizationId, productId]
  );
  return rows;
}

export async function getSupplierScores(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT supplier_id, price_score, stability_score, availability_score, total_score
     FROM supplier_score WHERE organization_id = $1`,
    [organizationId]
  );
  return rows;
}
