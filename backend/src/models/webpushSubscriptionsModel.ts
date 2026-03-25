import { pool } from '../db/pool.js';

export async function listByOrganization(organizationId: string): Promise<
  Array<{ id: string; endpoint: string; user_agent: string | null; created_at: string }>
> {
  const { rows } = await pool.query(
    `SELECT id::text, endpoint, user_agent, created_at::text
     FROM webpush_subscriptions WHERE organization_id = $1::uuid ORDER BY created_at DESC`,
    [organizationId]
  );
  return rows as Array<{ id: string; endpoint: string; user_agent: string | null; created_at: string }>;
}

export async function upsertSubscription(params: {
  organizationId: string;
  userId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO webpush_subscriptions (organization_id, user_id, endpoint, p256dh, auth, user_agent, last_used_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       last_used_at = NOW()`,
    [
      params.organizationId,
      params.userId,
      params.endpoint,
      params.p256dh,
      params.auth,
      params.userAgent ?? null,
    ]
  );
}

export async function deleteByEndpoint(organizationId: string, endpoint: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM webpush_subscriptions WHERE organization_id = $1::uuid AND endpoint = $2`,
    [organizationId, endpoint]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteById(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM webpush_subscriptions WHERE organization_id = $1::uuid AND id = $2::uuid`,
    [organizationId, id]
  );
  return (rowCount ?? 0) > 0;
}

export async function getAllSubsForSend(organizationId: string): Promise<
  Array<{ endpoint: string; p256dh: string; auth: string }>
> {
  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM webpush_subscriptions WHERE organization_id = $1::uuid`,
    [organizationId]
  );
  return rows as Array<{ endpoint: string; p256dh: string; auth: string }>;
}

export async function getSubsForUser(params: {
  organizationId: string;
  userId: string;
}): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth
     FROM webpush_subscriptions
     WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
    [params.organizationId, params.userId]
  );
  return rows as Array<{ endpoint: string; p256dh: string; auth: string }>;
}

export async function removeByEndpointGlobal(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM webpush_subscriptions WHERE endpoint = $1`, [endpoint]);
}
