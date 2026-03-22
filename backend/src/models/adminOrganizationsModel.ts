import { pool } from '../db/pool.js';

export async function listOrganizations(params: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    is_active: boolean;
    created_at: string;
    users_count: number;
    documents_last_30d: number;
  }>
> {
  const search = params.search?.trim() || null;
  const { rows } = await pool.query(
    `SELECT o.id, o.name, o.slug,
            COALESCE(o.plan, 'free') AS plan,
            COALESCE(o.is_active, TRUE) AS is_active,
            o.created_at::text,
            (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS users_count,
            (SELECT COUNT(*)::int FROM documents d
             WHERE d.organization_id = o.id
               AND d.created_at >= NOW() - INTERVAL '30 days') AS documents_last_30d
     FROM organizations o
     WHERE ($3::text IS NULL OR o.name ILIKE '%' || $3 || '%' OR o.slug ILIKE '%' || $3 || '%')
     ORDER BY o.created_at DESC
     LIMIT $1 OFFSET $2`,
    [params.limit, params.offset, search]
  );
  return rows as Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    is_active: boolean;
    created_at: string;
    users_count: number;
    documents_last_30d: number;
  }>;
}

export async function countOrganizations(search?: string): Promise<number> {
  const s = search?.trim() || null;
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM organizations o
     WHERE ($1::text IS NULL OR o.name ILIKE '%' || $1 || '%' OR o.slug ILIKE '%' || $1 || '%')`,
    [s]
  );
  return parseInt(rows[0]?.c ?? '0', 10);
}

export async function getOrganizationAdminDetail(organizationId: string): Promise<{
  org: Record<string, unknown>;
  users: Array<{ id: string; email: string; role: string; created_at: string }>;
} | null> {
  const { rows: orgRows } = await pool.query(
    `SELECT o.*, o.created_at::text AS created_at
     FROM organizations o WHERE o.id = $1::uuid`,
    [organizationId]
  );
  if (!orgRows[0]) return null;
  const { rows: users } = await pool.query(
    `SELECT id::text, email, role, created_at::text FROM users WHERE organization_id = $1::uuid ORDER BY created_at`,
    [organizationId]
  );
  return { org: orgRows[0] as Record<string, unknown>, users };
}

export async function platformStats(): Promise<{
  orgs_by_plan: Record<string, number>;
  documents_last_30d: number;
  active_users: number;
  total_orgs: number;
}> {
  const { rows: byPlan } = await pool.query<{ plan: string; c: string }>(
    `SELECT COALESCE(plan, 'free') AS plan, COUNT(*)::text AS c FROM organizations GROUP BY COALESCE(plan, 'free')`
  );
  const orgs_by_plan: Record<string, number> = {};
  for (const r of byPlan) orgs_by_plan[r.plan] = parseInt(r.c, 10);

  const { rows: d } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM documents WHERE created_at >= NOW() - INTERVAL '30 days'`
  );
  const { rows: u } = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM users`);
  const { rows: t } = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM organizations`);

  return {
    orgs_by_plan,
    documents_last_30d: parseInt(d[0]?.c ?? '0', 10),
    active_users: parseInt(u[0]?.c ?? '0', 10),
    total_orgs: parseInt(t[0]?.c ?? '0', 10),
  };
}
