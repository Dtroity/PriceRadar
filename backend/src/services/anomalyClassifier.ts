import {
  ANOMALY_THRESHOLD_HIGH,
  ANOMALY_THRESHOLD_LOW,
  ANOMALY_THRESHOLD_MEDIUM,
} from '../config/constants.js';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface ClassifyAnomalyResult {
  severity: AnomalySeverity;
  direction: 'up' | 'down';
  changePct: number;
}

/**
 * Pure classification from prices (no DB). Returns null if below low threshold or oldPrice invalid.
 */
export function classifyAnomaly(
  oldPrice: number | null,
  newPrice: number
): ClassifyAnomalyResult | null {
  if (oldPrice === null || oldPrice === 0 || !Number.isFinite(oldPrice) || !Number.isFinite(newPrice)) {
    return null;
  }
  const changePct = ((newPrice - oldPrice) / oldPrice) * 100;
  const abs = Math.abs(changePct);
  if (abs < ANOMALY_THRESHOLD_LOW * 100) return null;
  let severity: AnomalySeverity;
  if (abs >= ANOMALY_THRESHOLD_HIGH * 100) severity = 'high';
  else if (abs >= ANOMALY_THRESHOLD_MEDIUM * 100) severity = 'medium';
  else severity = 'low';
  const direction = newPrice >= oldPrice ? 'up' : 'down';
  return {
    severity,
    direction,
    changePct: Math.round(changePct * 100) / 100,
  };
}
