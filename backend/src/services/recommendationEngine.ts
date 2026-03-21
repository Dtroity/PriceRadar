import { pool } from '../db/pool.js';
import * as recModel from '../models/procurementRecommendationsModel.js';
import { logger } from '../utils/logger.js';
import { notifyRecommendationBatch } from './telegramNotifier.js';

async function topSupplierForProduct(
  organizationId: string,
  productId: string
): Promise<{ supplier_id: string } | null> {
  const { rows } = await pool.query<{ supplier_id: string }>(
    `SELECT supplier_id::text
     FROM supplier_prices_history
     WHERE organization_id = $1::uuid AND product_id = $2::uuid
     GROUP BY supplier_id
     ORDER BY COUNT(*) DESC, MAX(date) DESC
     LIMIT 1`,
    [organizationId, productId]
  );
  return rows[0] ?? null;
}

/**
 * Generates procurement recommendations for an organization. Returns number of new rows inserted.
 */
export async function generateRecommendations(organizationId: string): Promise<number> {
  const started = Date.now();
  let created = 0;
  const batchNotifySince = new Date();

  // 1) Low stock
  const { rows: lowStock } = await pool.query<{
    product_id: string;
    current_stock: string;
    min_stock: string;
    unit: string | null;
  }>(
    `SELECT product_id::text, current_stock::text, min_stock::text, unit
     FROM product_stock
     WHERE organization_id = $1::uuid
       AND min_stock > 0
       AND current_stock < min_stock`,
    [organizationId]
  );

  for (const row of lowStock) {
    const sup = await topSupplierForProduct(organizationId, row.product_id);
    const sid = sup?.supplier_id ?? null;
    if (await recModel.hasActiveDuplicate(organizationId, row.product_id, 'low_stock', sid)) continue;
    const qty = Math.max(
      1,
      parseFloat(row.min_stock) - parseFloat(row.current_stock) || 1
    );
    await recModel.insertRecommendation({
      organizationId,
      productId: row.product_id,
      supplierId: sid,
      reason: 'low_stock',
      suggestedQty: qty,
      suggestedPrice: null,
      priority: 1,
    });
    created++;
  }

  // 2) Price drop anomalies (24h)
  const { rows: drops } = await pool.query<{
    product_id: string;
    supplier_id: string | null;
    price_after: string;
  }>(
    `SELECT product_id::text, supplier_id::text, price_after::text
     FROM price_anomalies
     WHERE organization_id = $1::uuid
       AND direction = 'down'
       AND detected_at >= NOW() - INTERVAL '24 hours'`,
    [organizationId]
  );

  for (const row of drops) {
    const sid = row.supplier_id;
    if (await recModel.hasActiveDuplicate(organizationId, row.product_id, 'price_drop', sid)) continue;
    await recModel.insertRecommendation({
      organizationId,
      productId: row.product_id,
      supplierId: sid,
      reason: 'price_drop',
      suggestedQty: null,
      suggestedPrice: parseFloat(row.price_after),
      priority: 2,
    });
    created++;
  }

  // 3) Regular cycle (>=3 distinct delivery dates per product+supplier)
  const { rows: cycles } = await pool.query<{
    product_id: string;
    supplier_id: string;
    dates: string[];
  }>(
    `SELECT product_id::text, supplier_id::text, array_agg(d ORDER BY d) AS dates
     FROM (
       SELECT DISTINCT ON (product_id, supplier_id, date) product_id, supplier_id, date
       FROM supplier_prices_history
       WHERE organization_id = $1::uuid
     ) x
     GROUP BY product_id, supplier_id
     HAVING COUNT(*) >= 3`,
    [organizationId]
  );

  for (const row of cycles) {
    const dates = row.dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    if (dates.length < 3) continue;
    let sumGap = 0;
    for (let i = 1; i < dates.length; i++) sumGap += (dates[i]! - dates[i - 1]!) / 86400000;
    const avgInterval = sumGap / (dates.length - 1);
    const last = dates[dates.length - 1]!;
    const daysSince = (Date.now() - last) / 86400000;
    if (daysSince < avgInterval * 0.9) continue;
    if (
      await recModel.hasActiveDuplicate(
        organizationId,
        row.product_id,
        'regular_cycle',
        row.supplier_id
      )
    ) {
      continue;
    }
    await recModel.insertRecommendation({
      organizationId,
      productId: row.product_id,
      supplierId: row.supplier_id,
      reason: 'regular_cycle',
      suggestedQty: null,
      suggestedPrice: null,
      priority: 5,
    });
    created++;
  }

  logger.info({ organizationId, created, ms: Date.now() - started }, 'generateRecommendations');

  if (created > 0) {
    notifyRecommendationBatch(organizationId, batchNotifySince).catch((e) =>
      logger.warn({ e }, 'telegram recommendation batch failed')
    );
  }

  return created;
}
