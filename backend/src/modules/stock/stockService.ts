import { pool } from '../../db/pool.js';
import * as repo from './repository.js';

export async function getStockForecast(organizationId: string) {
  const items = await repo.listStock(organizationId);
  const result: Array<{
    product: string;
    product_id: string;
    stock_today: number;
    days_remaining: number;
    recommended_order_quantity: number;
    recommended_order_date: string | null;
  }> = [];

  for (const row of items) {
    const daily = await repo.getConsumptionFromRecipeUsage(organizationId, row.product_id, 14);
    const stockToday = Number(row.current_stock);
    const daysRemaining = daily > 0 ? stockToday / daily : 999;
    const daysToOrder = 3;
    const recommendedQty = daily > 0 ? Math.max(0, Math.ceil(daysToOrder * daily - stockToday)) : 0;
    const orderDate = daysRemaining <= daysToOrder && recommendedQty > 0
      ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      : null;

    result.push({
      product: row.product_name,
      product_id: row.product_id,
      stock_today: stockToday,
      days_remaining: Math.round(daysRemaining * 10) / 10,
      recommended_order_quantity: recommendedQty,
      recommended_order_date: orderDate,
    });
  }

  const { rows: products } = await pool.query(
    `SELECT p.id, p.name FROM products p WHERE p.organization_id = $1`,
    [organizationId]
  );
  const seen = new Set(items.map((i: { product_id: string }) => i.product_id));
  for (const p of products) {
    if (seen.has(p.id)) continue;
    result.push({
      product: p.name,
      product_id: p.id,
      stock_today: 0,
      days_remaining: 0,
      recommended_order_quantity: 0,
      recommended_order_date: null,
    });
  }
  return result;
}
