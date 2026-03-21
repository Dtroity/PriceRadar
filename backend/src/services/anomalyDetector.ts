import * as anomaliesModel from '../models/anomaliesModel.js';
import { logger } from '../utils/logger.js';
import { anomaliesDetectedTotal } from '../monitoring/metrics.js';
import { pool } from '../db/pool.js';
import { classifyAnomaly } from './anomalyClassifier.js';
import { notify } from './telegramNotifier.js';
import * as orgSettings from '../models/organizationsSettingsModel.js';
import { enqueueRecommendationsForOrg } from '../workers/recommendationsWorker.js';

/** Re-export pure classifier (no DB) for unit tests. */
export { classifyAnomaly };

export interface AnomalyCheckInput {
  organizationId: string;
  productId: string;
  supplierId: string;
  newPrice: number;
  documentId: string | null;
  currency: string;
  /** If omitted, treated as first observation (skip) */
  oldPrice?: number | null;
}

async function namesForNotify(
  productId: string,
  supplierId: string
): Promise<{ product_name: string; supplier_name: string }> {
  const { rows: p } = await pool.query<{ name: string }>('SELECT name FROM products WHERE id = $1::uuid', [
    productId,
  ]);
  const { rows: s } = await pool.query<{ name: string }>('SELECT name FROM suppliers WHERE id = $1::uuid', [
    supplierId,
  ]);
  return {
    product_name: p[0]?.name ?? productId,
    supplier_name: s[0]?.name ?? supplierId,
  };
}

/**
 * Records price anomalies. Expects oldPrice per item (from pre-insert snapshot).
 * Returns count of inserted anomaly rows.
 */
export async function checkAndRecordAnomalies(items: AnomalyCheckInput[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    if (it.oldPrice == null || it.oldPrice === 0) continue;
    const classified = classifyAnomaly(it.oldPrice, it.newPrice);
    if (!classified) continue;
    const { severity, direction, changePct } = classified;
    try {
      await anomaliesModel.insertAnomaly({
        organizationId: it.organizationId,
        productId: it.productId,
        supplierId: it.supplierId,
        priceBefore: it.oldPrice,
        priceAfter: it.newPrice,
        changePct,
        direction,
        severity,
        documentId: it.documentId,
      });
      anomaliesDetectedTotal.inc({ severity });
      n++;

      const { telegram_notify } = await orgSettings.getTelegramSettings(it.organizationId);
      const names = await namesForNotify(it.productId, it.supplierId);
      if (severity === 'high' && telegram_notify.anomaly_high) {
        notify(it.organizationId, {
          type: 'anomaly',
          anomaly: {
            product_name: names.product_name,
            supplier_name: names.supplier_name,
            price_before: it.oldPrice,
            price_after: it.newPrice,
            change_pct: changePct,
            severity: 'high',
          },
        }).catch(() => {});
      } else if (severity === 'medium' && telegram_notify.anomaly_medium) {
        notify(it.organizationId, {
          type: 'anomaly',
          anomaly: {
            product_name: names.product_name,
            supplier_name: names.supplier_name,
            price_before: it.oldPrice,
            price_after: it.newPrice,
            change_pct: changePct,
            severity: 'medium',
          },
        }).catch(() => {});
      }

      if (direction === 'down') {
        enqueueRecommendationsForOrg(it.organizationId).catch((e) =>
          logger.warn({ e }, 'enqueue recommendations after price drop failed')
        );
      }
    } catch (err) {
      logger.warn({ err, productId: it.productId }, 'anomaly insert failed');
    }
  }
  return n;
}
