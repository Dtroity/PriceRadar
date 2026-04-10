import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthRequest, UserRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import * as audit from '../models/adminAuditModel.js';

function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization context required' });
    return null;
  }
  return orgId;
}

function canManageRole(actor: UserRole, targetRole: string): boolean {
  if (actor === 'super_admin') return true;
  // org_admin cannot manage super_admin
  if (actor === 'org_admin' && targetRole === 'super_admin') return false;
  return actor === 'org_admin';
}

export async function listOrgUsers(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const { rows } = await pool.query(
    `SELECT id::text, email, role, COALESCE(is_active, TRUE) AS is_active, created_at::text
     FROM users
     WHERE organization_id = $1::uuid
     ORDER BY created_at ASC`,
    [orgId]
  );
  return res.json({ users: rows });
}

export async function createOrgUser(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  if (!req.user || (req.user.role !== 'org_admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const body = req.body as Partial<{ email: string; password: string; role: UserRole }>;
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();
  const role: UserRole = (body.role as UserRole) || 'manager';
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!['org_admin', 'manager', 'employee', 'supplier'].includes(role) && req.user.role !== 'super_admin') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (organization_id, email, password_hash, role, is_active)
     VALUES ($1::uuid, $2, $3, $4, TRUE)
     RETURNING id::text, organization_id::text, email, role, COALESCE(is_active, TRUE) AS is_active, created_at::text`,
    [orgId, email, password_hash, role]
  );
  const user = rows[0];
  if (req.user.role === 'super_admin') {
    await audit.logAdminAction({
      adminId: req.user.userId,
      organizationId: orgId,
      action: 'user_create',
      meta: { email, role },
    });
  }
  return res.status(201).json(user);
}

export async function patchOrgUser(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  if (!req.user || (req.user.role !== 'org_admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  const body = req.body as Partial<{ email: string | null; role: UserRole | null; is_active: boolean | null }>;

  const { rows: existing } = await pool.query<{ role: string; organization_id: string }>(
    'SELECT role, organization_id::text AS organization_id FROM users WHERE id = $1::uuid',
    [id]
  );
  const ex = existing[0];
  if (!ex || ex.organization_id !== orgId) return res.status(404).json({ error: 'Not found' });
  if (!canManageRole(req.user.role, ex.role)) return res.status(403).json({ error: 'Forbidden' });

  const email = body.email === undefined ? undefined : body.email === null ? null : String(body.email).trim().toLowerCase() || null;
  const role = body.role === undefined ? undefined : body.role === null ? null : (String(body.role) as UserRole);
  const is_active = body.is_active === undefined ? undefined : body.is_active === null ? null : Boolean(body.is_active);

  if (role !== undefined && role !== null) {
    const allowed: UserRole[] = req.user.role === 'super_admin'
      ? ['super_admin', 'org_admin', 'manager', 'employee', 'supplier']
      : ['org_admin', 'manager', 'employee', 'supplier'];
    if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  }

  const { rows } = await pool.query(
    `UPDATE users SET
        email = COALESCE($3, email),
        role = COALESCE($4, role),
        is_active = COALESCE($5, is_active)
     WHERE id = $1::uuid AND organization_id = $2::uuid
     RETURNING id::text, organization_id::text, email, role, COALESCE(is_active, TRUE) AS is_active, created_at::text`,
    [id, orgId, email ?? null, role ?? null, is_active ?? null]
  );
  const updated = rows[0];
  if (!updated) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'super_admin') {
    await audit.logAdminAction({
      adminId: req.user.userId,
      organizationId: orgId,
      action: 'user_patch',
      meta: { id, email, role, is_active },
    });
  }
  return res.json(updated);
}

export async function deleteOrgUser(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  if (!req.user || (req.user.role !== 'org_admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  if (req.user.userId === id) return res.status(400).json({ error: 'Cannot delete yourself' });

  const { rows: existing } = await pool.query<{ role: string; organization_id: string }>(
    'SELECT role, organization_id::text AS organization_id FROM users WHERE id = $1::uuid',
    [id]
  );
  const ex = existing[0];
  if (!ex || ex.organization_id !== orgId) return res.status(404).json({ error: 'Not found' });
  if (!canManageRole(req.user.role, ex.role)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id = $1::uuid AND organization_id = $2::uuid',
      [id, orgId]
    );
    if ((rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });
  } catch (err: any) {
    if (err?.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete user: referenced by other records. Block instead.' });
    }
    throw err;
  }

  if (req.user.role === 'super_admin') {
    await audit.logAdminAction({
      adminId: req.user.userId,
      organizationId: orgId,
      action: 'user_delete',
      meta: { id },
    });
  }
  return res.json({ ok: true });
}

// --- Super-admin: manage any user, any org ---

export async function createUserInOrg(req: AuthRequest, res: Response) {
  if (!req.user || req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const orgId = req.params.id;
  const body = req.body as Partial<{ email: string; password: string; role: UserRole }>;
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();
  const role: UserRole = (body.role as UserRole) || 'manager';
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const allowed: UserRole[] = ['super_admin', 'org_admin', 'manager', 'employee', 'supplier'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (organization_id, email, password_hash, role, is_active)
     VALUES ($1::uuid, $2, $3, $4, TRUE)
     RETURNING id::text, organization_id::text, email, role, COALESCE(is_active, TRUE) AS is_active, created_at::text`,
    [orgId, email, password_hash, role]
  );
  const user = rows[0];
  await audit.logAdminAction({
    adminId: req.user.userId,
    organizationId: orgId,
    action: 'user_create',
    meta: { email, role },
  });
  return res.status(201).json(user);
}

export async function patchAnyUser(req: AuthRequest, res: Response) {
  if (!req.user || req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  const body = req.body as Partial<{ email: string | null; role: UserRole | null; is_active: boolean | null }>;

  const email = body.email === undefined ? undefined : body.email === null ? null : String(body.email).trim().toLowerCase() || null;
  const role = body.role === undefined ? undefined : body.role === null ? null : (String(body.role) as UserRole);
  const is_active = body.is_active === undefined ? undefined : body.is_active === null ? null : Boolean(body.is_active);

  if (role !== undefined && role !== null) {
    const allowed: UserRole[] = ['super_admin', 'org_admin', 'manager', 'employee', 'supplier'];
    if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  }

  const { rows } = await pool.query(
    `UPDATE users SET
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        is_active = COALESCE($4, is_active)
     WHERE id = $1::uuid
     RETURNING id::text, organization_id::text, email, role, COALESCE(is_active, TRUE) AS is_active, created_at::text`,
    [id, email ?? null, role ?? null, is_active ?? null]
  );
  const updated = rows[0];
  if (!updated) return res.status(404).json({ error: 'Not found' });
  await audit.logAdminAction({
    adminId: req.user.userId,
    organizationId: updated.organization_id,
    action: 'user_patch',
    meta: { id, email, role, is_active },
  });
  return res.json(updated);
}

export async function deleteAnyUser(req: AuthRequest, res: Response) {
  if (!req.user || req.user.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  if (req.user.userId === id) return res.status(400).json({ error: 'Cannot delete yourself' });
  try {
    const { rows } = await pool.query<{ organization_id: string }>(
      'SELECT organization_id::text AS organization_id FROM users WHERE id = $1::uuid',
      [id]
    );
    const orgId = rows[0]?.organization_id ?? null;

    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1::uuid', [id]);
    if ((rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });

    await audit.logAdminAction({
      adminId: req.user.userId,
      organizationId: orgId,
      action: 'user_delete',
      meta: { id },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete user: referenced by other records. Block instead.' });
    }
    throw err;
  }
}

