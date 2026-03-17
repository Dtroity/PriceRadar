import { pool } from '../db/pool.js';

export interface Recipe {
  id: string;
  organization_id: string;
  name: string;
  created_at: Date;
}

export async function listRecipes(organizationId: string): Promise<Recipe[]> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, name, created_at FROM recipes WHERE organization_id = $1 ORDER BY name`,
    [organizationId]
  );
  return rows;
}
