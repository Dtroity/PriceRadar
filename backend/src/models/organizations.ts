import { pool } from '../db/pool.js';
import type { Organization } from '../types/index.js';

export type OrgPlan = 'free' | 'pro' | 'enterprise';

export async function findBySlug(slug: string): Promise<Organization | null> {
  const { rows } = await pool.query(
    'SELECT id, name, slug, created_at FROM organizations WHERE slug = $1',
    [slug.toLowerCase().trim()]
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Organization | null> {
  const { rows } = await pool.query(
    'SELECT id, name, slug, created_at FROM organizations WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function create(
  name: string,
  slug: string,
  options?: { industry?: string | null; plan?: OrgPlan }
): Promise<Organization> {
  const s = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const plan = options?.plan ?? 'free';
  const industry = options?.industry ?? null;
  const { rows } = await pool.query(
    `INSERT INTO organizations (name, slug, plan, industry)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, created_at`,
    [name, s || 'org', plan, industry]
  );
  return rows[0];
}

export async function updateAdminFields(
  id: string,
  patch: Partial<{
    plan: OrgPlan;
    plan_expires_at: Date | null;
    is_active: boolean;
    max_users: number;
    max_documents_mo: number;
    notes: string | null;
    industry: string | null;
  }>
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [id];
  let i = 1;
  const add = (col: string, v: unknown) => {
    i++;
    sets.push(`${col} = $${i}`);
    vals.push(v);
  };
  if (patch.plan !== undefined) add('plan', patch.plan);
  if (patch.plan_expires_at !== undefined) add('plan_expires_at', patch.plan_expires_at);
  if (patch.is_active !== undefined) add('is_active', patch.is_active);
  if (patch.max_users !== undefined) add('max_users', patch.max_users);
  if (patch.max_documents_mo !== undefined) add('max_documents_mo', patch.max_documents_mo);
  if (patch.notes !== undefined) add('notes', patch.notes);
  if (patch.industry !== undefined) add('industry', patch.industry);
  if (sets.length === 0) return;
  await pool.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $1::uuid`, vals);
}
