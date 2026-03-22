import { pool } from '../db/pool.js';

export async function logAdminAction(params: {
  adminId: string;
  organizationId: string | null;
  action: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO admin_audit_log (admin_id, organization_id, action, meta)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
    [params.adminId, params.organizationId, params.action, JSON.stringify(params.meta ?? {})]
  );
}
