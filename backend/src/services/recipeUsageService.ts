import { pool } from '../db/pool.js';
import * as stockRepo from '../modules/stock/repository.js';

export async function consumeRecipe(recipeId: string, organizationId: string, dishQuantity: number): Promise<void> {
  const { rows: recipe } = await pool.query(
    `SELECT id, organization_id FROM recipes WHERE id = $1 AND organization_id = $2`,
    [recipeId, organizationId]
  );
  if (!recipe[0]) throw new Error('Recipe not found');

  const { rows: items } = await pool.query(
    `SELECT product_id, quantity FROM recipe_items WHERE recipe_id = $1`,
    [recipeId]
  );
  for (const it of items) {
    const qty = -Number(it.quantity) * dishQuantity;
    if (qty === 0) continue;
    await stockRepo.addStock(organizationId, it.product_id, qty, 'recipe_usage', `recipe:${recipeId}`);
  }
}
