/** Aggregates read-only queries for agent inputs (integrates price-monitoring, forecast, supplier-intelligence). */
import { pool } from '../../db/pool.js';

export async function latestPricesForOrg(organizationId: string) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.product_id) p.product_id, p.price, pl.supplier_id
     FROM prices p
     JOIN price_lists pl ON pl.id = p.price_list_id
     WHERE pl.organization_id = $1
     ORDER BY p.product_id, pl.upload_date DESC NULLS LAST, pl.created_at DESC
     LIMIT 500`,
    [organizationId]
  );
  return rows;
}
