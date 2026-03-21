import { pool } from '../db/pool.js';

export type RecReason = 'low_stock' | 'price_drop' | 'regular_cycle';
export type RecStatus = 'active' | 'accepted' | 'dismissed';

export interface RecommendationRow {
  id: string;
  organization_id: string;
  product_id: string;
  supplier_id: string | null;
  reason: RecReason;
  suggested_qty: string | null;
  suggested_price: string | null;
  priority: number;
  status: RecStatus;
  generated_at: string;
  expires_at: string | null;
  order_id: string | null;
  product_name?: string;
  supplier_name?: string | null;
}

export async function hasActiveDuplicate(
  organizationId: string,
  productId: string,
  reason: RecReason,
  supplierId: string | null
): Promise<boolean> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM procurement_recommendations
     WHERE organization_id = $1::uuid AND product_id = $2::uuid AND reason = $3
       AND status = 'active'
       AND COALESCE(supplier_id::text, '') = COALESCE($4::text, '')`,
    [organizationId, productId, reason, supplierId]
  );
  return parseInt(rows[0]?.c ?? '0', 10) > 0;
}

export async function insertRecommendation(params: {
  organizationId: string;
  productId: string;
  supplierId: string | null;
  reason: RecReason;
  suggestedQty: number | null;
  suggestedPrice: number | null;
  priority: number;
  expiresAt?: Date | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO procurement_recommendations
      (organization_id, product_id, supplier_id, reason, suggested_qty, suggested_price, priority, expires_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)`,
    [
      params.organizationId,
      params.productId,
      params.supplierId,
      params.reason,
      params.suggestedQty,
      params.suggestedPrice,
      params.priority,
      params.expiresAt ?? null,
    ]
  );
}

export async function listActive(
  organizationId: string,
  filters: { reason?: RecReason; priorityMax?: number } = {}
): Promise<RecommendationRow[]> {
  const cond = ["organization_id = $1::uuid", "status = 'active'"];
  const params: unknown[] = [organizationId];
  let i = 1;
  if (filters.reason) {
    i++;
    cond.push(`reason = $${i}`);
    params.push(filters.reason);
  }
  if (filters.priorityMax != null) {
    i++;
    cond.push(`priority <= $${i}`);
    params.push(filters.priorityMax);
  }
  const { rows } = await pool.query<RecommendationRow>(
    `SELECT r.id, r.organization_id, r.product_id, r.supplier_id, r.reason,
            r.suggested_qty::text, r.suggested_price::text, r.priority, r.status,
            r.generated_at, r.expires_at::text, r.order_id::text,
            p.name AS product_name, s.name AS supplier_name
     FROM procurement_recommendations r
     JOIN products p ON p.id = r.product_id
     LEFT JOIN suppliers s ON s.id = r.supplier_id
     WHERE ${cond.join(' AND ')}
     ORDER BY r.priority ASC, r.generated_at DESC`,
    params
  );
  return rows;
}

export async function getById(
  id: string,
  organizationId: string
): Promise<RecommendationRow | null> {
  const { rows } = await pool.query<RecommendationRow>(
    `SELECT r.id, r.organization_id, r.product_id, r.supplier_id, r.reason,
            r.suggested_qty::text, r.suggested_price::text, r.priority, r.status,
            r.generated_at, r.expires_at::text, r.order_id::text,
            p.name AS product_name, s.name AS supplier_name
     FROM procurement_recommendations r
     JOIN products p ON p.id = r.product_id
     LEFT JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.id = $1::uuid AND r.organization_id = $2::uuid`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function acceptRecommendation(
  id: string,
  organizationId: string,
  orderId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE procurement_recommendations
     SET status = 'accepted', order_id = $3::uuid
     WHERE id = $1::uuid AND organization_id = $2::uuid AND status = 'active'`,
    [id, organizationId, orderId]
  );
  return (rowCount ?? 0) > 0;
}

export async function dismissRecommendation(id: string, organizationId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE procurement_recommendations SET status = 'dismissed'
     WHERE id = $1::uuid AND organization_id = $2::uuid AND status = 'active'`,
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

export async function listNewSince(
  organizationId: string,
  since: Date
): Promise<RecommendationRow[]> {
  const { rows } = await pool.query<RecommendationRow>(
    `SELECT r.id, r.organization_id, r.product_id, r.supplier_id, r.reason,
            r.suggested_qty::text, r.suggested_price::text, r.priority, r.status,
            r.generated_at, r.expires_at::text, r.order_id::text,
            p.name AS product_name, s.name AS supplier_name
     FROM procurement_recommendations r
     JOIN products p ON p.id = r.product_id
     LEFT JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.organization_id = $1::uuid AND r.status = 'active' AND r.generated_at >= $2
     ORDER BY r.priority ASC`,
    [organizationId, since]
  );
  return rows;
}
