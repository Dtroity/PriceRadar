import { pool } from '../../db/pool.js';

export async function getFoodcostForecast(organizationId: string) {
  const { rows: menuRows } = await pool.query(
    `SELECT mi.id, mi.name AS dish, mi.selling_price, mi.recipe_id
     FROM menu_items mi WHERE mi.organization_id = $1`,
    [organizationId]
  );

  const { rows: forecastRows } = await pool.query(
    `SELECT product_id, AVG(predicted_price)::numeric(12,2) AS forecast_30d
     FROM price_forecasts
     WHERE organization_id = $1 AND horizon_days = 30
     GROUP BY product_id`,
    [organizationId]
  );
  const forecastByProduct = new Map(forecastRows.map((r: { product_id: string; forecast_30d: number }) => [r.product_id, Number(r.forecast_30d)]));

  const result: Array<{
    dish: string;
    current_cost: number;
    forecast_cost_30d: number;
    margin_change: number;
    selling_price: number;
  }> = [];

  for (const mi of menuRows) {
    const { rows: recipeItems } = await pool.query(
      `SELECT ri.product_id, ri.quantity FROM recipe_items ri WHERE ri.recipe_id = $1`,
      [mi.recipe_id]
    );

    let currentCost = 0;
    let forecastCost = 0;
    for (const ri of recipeItems) {
      const { rows: priceRow } = await pool.query(
        `SELECT pr.price FROM prices pr
         JOIN price_lists pl ON pl.id = pr.price_list_id
         WHERE pl.organization_id = $1 AND pr.product_id = $2
         ORDER BY pl.upload_date DESC LIMIT 1`,
        [organizationId, ri.product_id]
      );
      const currentPrice = priceRow[0] ? Number(priceRow[0].price) : 0;
      const f30 = forecastByProduct.get(ri.product_id) ?? currentPrice;
      currentCost += Number(ri.quantity) * currentPrice;
      forecastCost += Number(ri.quantity) * f30;
    }
    const sellingPrice = Number(mi.selling_price);
    const currentMargin = sellingPrice - currentCost;
    const forecastMargin = sellingPrice - forecastCost;
    result.push({
      dish: mi.name,
      current_cost: currentCost,
      forecast_cost_30d: forecastCost,
      margin_change: forecastMargin - currentMargin,
      selling_price: sellingPrice,
    });
  }
  return result;
}
