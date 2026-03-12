import { pool } from '../db/pool.js';

export async function insertPrices(
  priceListId: string,
  items: { product_id: string; price: number; currency: string }[]
): Promise<void> {
  if (items.length === 0) return;
  const values = items
    .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
    .join(', ');
  const params = items.flatMap((p) => [priceListId, p.product_id, p.price, p.currency]);
  await pool.query(
    `INSERT INTO prices (price_list_id, product_id, price, currency) VALUES ${values}`,
    params
  );
}

export async function getPricesByPriceListId(priceListId: string): Promise<{ product_id: string; price: number; currency: string }[]> {
  const { rows } = await pool.query(
    'SELECT product_id, price, currency FROM prices WHERE price_list_id = $1',
    [priceListId]
  );
  return rows;
}
