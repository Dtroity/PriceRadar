import { pool } from '../../db/pool.js';

export async function getCurrentProductPrice(organizationId: string, productId: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT pr.price FROM prices pr
     JOIN price_lists pl ON pl.id = pr.price_list_id
     WHERE pl.organization_id = $1 AND pr.product_id = $2
     ORDER BY pl.upload_date DESC, pl.created_at DESC LIMIT 1`,
    [organizationId, productId]
  );
  return rows[0] ? Number(rows[0].price) : null;
}

export async function getMenuItemsByProductId(organizationId: string, productId: string) {
  const { rows } = await pool.query(
    `SELECT mi.id, mi.name, mi.recipe_id, mi.selling_price
     FROM menu_items mi
     JOIN recipe_items ri ON ri.recipe_id = mi.recipe_id
     WHERE mi.organization_id = $1 AND ri.product_id = $2`,
    [organizationId, productId]
  );
  return rows;
}

export async function getRecipeItems(recipeId: string) {
  const { rows } = await pool.query(
    `SELECT product_id, quantity FROM recipe_items WHERE recipe_id = $1`,
    [recipeId]
  );
  return rows;
}

export async function insertFoodCostHistory(menuItemId: string, cost: number, margin: number, foodCostPercent: number) {
  await pool.query(
    `INSERT INTO food_cost_history (menu_item_id, cost, margin, food_cost_percent) VALUES ($1, $2, $3, $4)`,
    [menuItemId, cost, margin, foodCostPercent]
  );
}

export async function createFoodcostAlert(menuItemId: string, foodCostPercent: number) {
  await pool.query(
    `INSERT INTO foodcost_alerts (menu_item_id, food_cost_percent, status) VALUES ($1, $2, 'active')`,
    [menuItemId, foodCostPercent]
  );
}
