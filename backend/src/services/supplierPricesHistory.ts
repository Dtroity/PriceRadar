import { pool } from '../db/pool.js';
import * as priceListsModel from '../models/priceLists.js';
import * as pricesModel from '../models/prices.js';

export async function recordFromPriceList(priceListId: string): Promise<void> {
  const pl = await priceListsModel.getPriceListById(priceListId);
  if (!pl?.organization_id) return;
  const prices = await pricesModel.getPricesByPriceListId(priceListId);
  const date = pl.upload_date instanceof Date ? pl.upload_date.toISOString().slice(0, 10) : String(pl.upload_date).slice(0, 10);
  for (const p of prices) {
    await pool.query(
      `INSERT INTO supplier_prices_history (organization_id, supplier_id, product_id, price, date)
       VALUES ($1, $2, $3, $4, $5)`,
      [pl.organization_id, pl.supplier_id, p.product_id, p.price, date]
    );
  }
}
