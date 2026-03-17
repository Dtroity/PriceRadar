import { pool } from '../db/pool.js';
import type { PriceForecast } from '../types/index.js';

export async function listByOrganization(
  organizationId: string,
  filters: { productId?: string; horizonDays?: number } = {},
  limit = 200
): Promise<PriceForecast[]> {
  let query = `SELECT id, organization_id, product_id, supplier_id, forecast_date, horizon_days, predicted_price, created_at
   FROM price_forecasts WHERE organization_id = $1`;
  const params: unknown[] = [organizationId];
  if (filters.productId) {
    params.push(filters.productId);
    query += ` AND product_id = $${params.length}`;
  }
  if (filters.horizonDays) {
    params.push(filters.horizonDays);
    query += ` AND horizon_days = $${params.length}`;
  }
  params.push(limit);
  query += ` ORDER BY forecast_date ASC LIMIT $${params.length}`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function save(
  organizationId: string,
  productId: string,
  supplierId: string | null,
  forecastDate: string,
  horizonDays: number,
  predictedPrice: number
): Promise<PriceForecast> {
  const { rows } = await pool.query(
    `INSERT INTO price_forecasts (organization_id, product_id, supplier_id, forecast_date, horizon_days, predicted_price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, product_id, supplier_id, forecast_date, horizon_days, predicted_price, created_at`,
    [organizationId, productId, supplierId, forecastDate, horizonDays, predictedPrice]
  );
  return rows[0];
}
