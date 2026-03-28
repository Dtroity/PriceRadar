import { pool } from '../db/pool.js';
import { insertAudit } from './productAuditLog.js';
import { logger } from '../utils/logger.js';
import { checkAndRecordAnomalies } from '../services/anomalyDetector.js';

export type InsertPricesOptions = {
  /** User who triggered the change (e.g. document confirm); null for workers/system */
  actorUserId?: string | null;
  /** Source document when prices come from invoice confirmation */
  documentId?: string | null;
};

export async function insertPrices(
  priceListId: string,
  items: { product_id: string; price: number; currency: string }[],
  options?: InsertPricesOptions
): Promise<void> {
  if (items.length === 0) return;

  const { rows: plRows } = await pool.query<{ organization_id: string; supplier_id: string }>(
    'SELECT organization_id, supplier_id FROM price_lists WHERE id = $1',
    [priceListId]
  );
  const pl = plRows[0];
  if (!pl) {
    logger.error({ priceListId, itemCount: items.length }, 'insertPrices: price_list row missing');
    throw new Error(`insertPrices: price list not found (${priceListId})`);
  }

  const docId = options?.documentId ?? null;
  const oldPriceByProduct = new Map<string, number | null>();
  for (const p of items) {
    if (oldPriceByProduct.has(p.product_id)) continue;
    const { rows } = await pool.query<{ price: string }>(
      `SELECT p.price::text AS price
       FROM prices p
       JOIN price_lists pl ON p.price_list_id = pl.id
       WHERE p.product_id = $1::uuid
         AND pl.supplier_id = $2::uuid
         AND pl.organization_id = $3::uuid
       ORDER BY COALESCE(p.created_at, pl.created_at) DESC
       LIMIT 1`,
      [p.product_id, pl.supplier_id, pl.organization_id]
    );
    oldPriceByProduct.set(p.product_id, rows[0] ? parseFloat(rows[0].price) : null);
  }

  const parts: string[] = [];
  const params: unknown[] = [priceListId];
  let idx = 2;
  for (const p of items) {
    parts.push(`($1, $${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
    params.push(p.product_id, p.price, p.currency, docId);
    idx += 4;
  }
  await pool.query(
    `INSERT INTO prices (price_list_id, product_id, price, currency, document_id) VALUES ${parts.join(', ')}`,
    params
  );

  const actorId = options?.actorUserId ?? null;
  for (const p of items) {
    try {
      await insertAudit({
        organizationId: pl.organization_id,
        productId: p.product_id,
        action: 'price_change',
        actorId,
        meta: {
          supplier_id: pl.supplier_id,
          old_price: null,
          new_price: p.price,
          currency: p.currency,
          price_list_id: priceListId,
        },
      });
    } catch (err) {
      logger.warn(
        { err, priceListId, productId: p.product_id },
        'price_change audit insert failed (best-effort)'
      );
    }
  }

  const anomalyItems = items.map((p) => ({
    organizationId: pl.organization_id,
    productId: p.product_id,
    supplierId: pl.supplier_id,
    newPrice: p.price,
    documentId: docId,
    currency: p.currency,
    oldPrice: oldPriceByProduct.get(p.product_id) ?? null,
  }));
  checkAndRecordAnomalies(anomalyItems)
    .then((n) => {
      if (n > 0) logger.info({ priceListId, anomalies: n }, 'price anomalies recorded');
    })
    .catch((err) => logger.warn({ err, priceListId }, 'anomaly detection failed'));
}

export async function getPricesByPriceListId(priceListId: string): Promise<{ product_id: string; price: number; currency: string }[]> {
  const { rows } = await pool.query(
    'SELECT product_id, price, currency FROM prices WHERE price_list_id = $1',
    [priceListId]
  );
  return rows;
}
