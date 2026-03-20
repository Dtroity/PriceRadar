import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';

export type ProductAuditAction = 'merge' | 'normalize' | 'price_change' | 'update';

export interface ProductAuditRow {
  id: string;
  organization_id: string;
  product_id: string;
  action: string;
  actor_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function insertAudit(
  params: {
    organizationId: string;
    productId: string;
    action: ProductAuditAction;
    actorId?: string | null;
    meta?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<void> {
  const q = `INSERT INTO product_audit_log (organization_id, product_id, action, actor_id, meta)
    VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::jsonb)`;
  const values = [
    params.organizationId,
    params.productId,
    params.action,
    params.actorId ?? null,
    JSON.stringify(params.meta ?? {}),
  ];
  if (client) {
    await client.query(q, values);
  } else {
    await pool.query(q, values);
  }
}

export async function getByProductId(
  organizationId: string,
  productId: string,
  limit = 100
): Promise<ProductAuditRow[]> {
  const { rows } = await pool.query<ProductAuditRow>(
    `SELECT id, organization_id, product_id, action, actor_id, meta, created_at
     FROM product_audit_log
     WHERE organization_id = $1::uuid AND product_id = $2::uuid
     ORDER BY created_at DESC
     LIMIT $3`,
    [organizationId, productId, limit]
  );
  return rows;
}
