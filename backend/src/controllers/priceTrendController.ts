import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import { pool } from '../db/pool.js';

export async function priceTrend(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const productId = req.params.id;
    if (!productId) return res.status(400).json({ error: 'product id required' });

    const [supplierPrices, history, changes, forecasts] = await Promise.all([
      pool.query(
        `SELECT pl.supplier_id, s.name AS supplier_name, pl.upload_date::text AS date, pr.price
         FROM prices pr
         JOIN price_lists pl ON pl.id = pr.price_list_id
         JOIN suppliers s ON s.id = pl.supplier_id
         WHERE pl.organization_id = $1 AND pr.product_id = $2
         ORDER BY pl.upload_date DESC LIMIT 50`,
        [organizationId, productId]
      ),
      pool.query(
        `SELECT date::text, price, supplier_id FROM supplier_prices_history
         WHERE organization_id = $1 AND product_id = $2 ORDER BY date DESC LIMIT 90`,
        [organizationId, productId]
      ),
      pool.query(
        `SELECT old_price, new_price, change_percent, created_at::text, supplier_id
         FROM price_changes WHERE organization_id = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 20`,
        [organizationId, productId]
      ),
      pool.query(
        `SELECT forecast_date::text, predicted_price, horizon_days
         FROM price_forecasts WHERE organization_id = $1 AND product_id = $2 ORDER BY forecast_date LIMIT 30`,
        [organizationId, productId]
      ),
    ]);

    res.json({
      supplier_prices: supplierPrices.rows,
      historical_trend: history.rows,
      price_changes: changes.rows,
      forecast: forecasts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get price trend' });
  }
}
