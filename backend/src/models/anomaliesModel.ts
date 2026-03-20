import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

export type AnomalySeverity = 'low' | 'medium' | 'high';
export type AnomalyDirection = 'up' | 'down';

export interface PriceAnomalyRow {
  id: string;
  organization_id: string;
  product_id: string;
  supplier_id: string | null;
  detected_at: string;
  price_before: string;
  price_after: string;
  change_pct: string;
  direction: AnomalyDirection;
  severity: AnomalySeverity;
  document_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  product_name?: string;
  supplier_name?: string | null;
}

export async function insertAnomaly(
  params: {
    organizationId: string;
    productId: string;
    supplierId: string;
    priceBefore: number;
    priceAfter: number;
    changePct: number;
    direction: AnomalyDirection;
    severity: AnomalySeverity;
    documentId: string | null;
  },
  client?: PoolClient
): Promise<void> {
  const q = `INSERT INTO price_anomalies (
    organization_id, product_id, supplier_id, price_before, price_after, change_pct, direction, severity, document_id
  ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::uuid)`;
  const values = [
    params.organizationId,
    params.productId,
    params.supplierId,
    params.priceBefore,
    params.priceAfter,
    params.changePct,
    params.direction,
    params.severity,
    params.documentId,
  ];
  if (client) await client.query(q, values);
  else await pool.query(q, values);
}

export interface ListAnomaliesFilters {
  organizationId: string;
  severity?: AnomalySeverity;
  acknowledged?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export async function listAnomalies(filters: ListAnomaliesFilters): Promise<PriceAnomalyRow[]> {
  const limit = Math.min(filters.limit ?? 100, 500);
  const offset = filters.offset ?? 0;
  const conditions: string[] = ['pa.organization_id = $1::uuid'];
  const params: unknown[] = [filters.organizationId];
  let n = 1;

  if (filters.severity) {
    n++;
    conditions.push(`pa.severity = $${n}`);
    params.push(filters.severity);
  }
  if (filters.acknowledged !== undefined) {
    n++;
    conditions.push(`pa.acknowledged = $${n}`);
    params.push(filters.acknowledged);
  }
  if (filters.dateFrom) {
    n++;
    conditions.push(`pa.detected_at >= $${n}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    n++;
    conditions.push(`pa.detected_at < $${n}`);
    params.push(filters.dateTo);
  }

  n++;
  params.push(limit);
  const limParam = n;
  n++;
  params.push(offset);
  const offParam = n;

  const { rows } = await pool.query<PriceAnomalyRow>(
    `SELECT pa.id, pa.organization_id, pa.product_id, pa.supplier_id, pa.detected_at,
            pa.price_before, pa.price_after, pa.change_pct, pa.direction, pa.severity,
            pa.document_id, pa.acknowledged, pa.acknowledged_by, pa.acknowledged_at,
            pr.name AS product_name, s.name AS supplier_name
     FROM price_anomalies pa
     JOIN products pr ON pr.id = pa.product_id AND pr.organization_id = pa.organization_id
     LEFT JOIN suppliers s ON s.id = pa.supplier_id AND s.organization_id = pa.organization_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY pa.detected_at DESC
     LIMIT $${limParam} OFFSET $${offParam}`,
    params
  );
  return rows;
}

export async function countUnread(organizationId: string): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM price_anomalies
     WHERE organization_id = $1::uuid AND acknowledged = FALSE`,
    [organizationId]
  );
  return parseInt(rows[0]?.c ?? '0', 10);
}

export async function acknowledgeAnomaly(
  id: string,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE price_anomalies
     SET acknowledged = TRUE, acknowledged_by = $3::uuid, acknowledged_at = NOW()
     WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [id, organizationId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function countAnomaliesInPeriod(organizationId: string, periodDays: number): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM price_anomalies
     WHERE organization_id = $1::uuid
       AND detected_at >= NOW() - $2::int * INTERVAL '1 day'`,
    [organizationId, periodDays]
  );
  return parseInt(rows[0]?.c ?? '0', 10);
}
