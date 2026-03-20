import {
  ANOMALY_THRESHOLD_HIGH,
  ANOMALY_THRESHOLD_LOW,
  ANOMALY_THRESHOLD_MEDIUM,
} from '../config/constants.js';
import * as anomaliesModel from '../models/anomaliesModel.js';
import { logger } from '../utils/logger.js';
import { anomaliesDetectedTotal } from '../monitoring/metrics.js';

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

function severityForChangePct(absPct: number): 'low' | 'medium' | 'high' | null {
  if (absPct >= ANOMALY_THRESHOLD_HIGH * 100) return 'high';
  if (absPct >= ANOMALY_THRESHOLD_MEDIUM * 100) return 'medium';
  if (absPct >= ANOMALY_THRESHOLD_LOW * 100) return 'low';
  return null;
}

/**
 * Records price anomalies. Expects oldPrice per item (from pre-insert snapshot).
 * Returns count of inserted anomaly rows.
 */
export async function checkAndRecordAnomalies(items: AnomalyCheckInput[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    if (it.oldPrice == null || it.oldPrice === 0) continue;
    const change_pct = ((it.newPrice - it.oldPrice) / it.oldPrice) * 100;
    const abs = Math.abs(change_pct);
    const severity = severityForChangePct(abs);
    if (!severity) continue;
    const direction = it.newPrice >= it.oldPrice ? 'up' : 'down';
    try {
      await anomaliesModel.insertAnomaly({
        organizationId: it.organizationId,
        productId: it.productId,
        supplierId: it.supplierId,
        priceBefore: it.oldPrice,
        priceAfter: it.newPrice,
        changePct: Math.round(change_pct * 100) / 100,
        direction,
        severity,
        documentId: it.documentId,
      });
      anomaliesDetectedTotal.inc({ severity });
      n++;
    } catch (err) {
      logger.warn({ err, productId: it.productId }, 'anomaly insert failed');
    }
  }
  return n;
}
