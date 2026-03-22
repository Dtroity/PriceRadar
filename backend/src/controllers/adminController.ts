import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthRequest } from '../auth/middleware.js';
import * as orgModel from '../models/organizations.js';
import * as adminOrg from '../models/adminOrganizationsModel.js';
import * as orgModules from '../models/organizationModulesModel.js';
import * as audit from '../models/adminAuditModel.js';
import { invalidateSubscriptionCache } from '../modules/_shared/subscriptionRepository.js';
import { isKnownModuleKey } from '../config/modules.js';
import { pool } from '../db/pool.js';

function requireSuperAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function listOrganizations(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const q = req.query.q as string | undefined;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    adminOrg.listOrganizations({ search: q, limit, offset }),
    adminOrg.countOrganizations(q),
  ]);
  return res.json({ organizations: rows, total, page, limit });
}

export async function getOrganization(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const data = await adminOrg.getOrganizationAdminDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const modules = await orgModules.listModules(req.params.id);
  return res.json({ ...data, modules });
}

export async function createOrganization(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const { name, plan, adminEmail, adminPassword } = req.body as {
    name?: string;
    plan?: orgModel.OrgPlan;
    adminEmail?: string;
    adminPassword?: string;
  };
  if (!name || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'name, adminEmail, adminPassword required' });
  }
  const p = plan === 'pro' || plan === 'enterprise' ? plan : 'free';
  const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
  const org = await orgModel.create(name, slug, { plan: p });
  await orgModules.replaceModulesForPlan(org.id, p);
  const password_hash = await bcrypt.hash(adminPassword, 10);
  const { rows } = await pool.query<{ id: string; email: string; role: string }>(
    `INSERT INTO users (organization_id, email, password_hash, role)
     VALUES ($1::uuid, $2, $3, 'org_admin') RETURNING id, email, role`,
    [org.id, adminEmail, password_hash]
  );
  const user = rows[0]!;
  await audit.logAdminAction({
    adminId: req.user!.userId,
    organizationId: org.id,
    action: 'org_create',
    meta: { name, plan: p, adminEmail },
  });
  return res.status(201).json({ organization: org, admin: user });
}

export async function patchOrganization(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const id = req.params.id;
  const body = req.body as Partial<{
    plan: orgModel.OrgPlan;
    is_active: boolean;
    max_users: number;
    max_documents_mo: number;
    notes: string | null;
    plan_expires_at: string | null;
  }>;
  const existing = await orgModel.findById(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  await orgModel.updateAdminFields(id, {
    plan: body.plan,
    is_active: body.is_active,
    max_users: body.max_users,
    max_documents_mo: body.max_documents_mo,
    notes: body.notes,
    plan_expires_at: body.plan_expires_at ? new Date(body.plan_expires_at) : body.plan_expires_at === null ? null : undefined,
  });

  if (body.plan === 'free' || body.plan === 'pro' || body.plan === 'enterprise') {
    await orgModules.replaceModulesForPlan(id, body.plan);
    invalidateSubscriptionCache(id);
  }

  await audit.logAdminAction({
    adminId: req.user!.userId,
    organizationId: id,
    action: 'org_patch',
    meta: body as Record<string, unknown>,
  });
  return res.json({ ok: true });
}

export async function listOrgModules(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const rows = await orgModules.listModules(req.params.id);
  return res.json({ modules: rows });
}

export async function patchOrgModule(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const { module, enabled } = req.body as { module?: string; enabled?: boolean };
  if (module === undefined || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'module and enabled required' });
  }
  if (!isKnownModuleKey(module)) {
    return res.status(400).json({ error: 'Unknown module' });
  }
  const id = req.params.id;
  const ex = await orgModel.findById(id);
  if (!ex) return res.status(404).json({ error: 'Not found' });
  await orgModules.setModuleEnabled(id, module, enabled, req.user!.userId);
  invalidateSubscriptionCache(id);
  await audit.logAdminAction({
    adminId: req.user!.userId,
    organizationId: id,
    action: 'module_toggle',
    meta: { module, enabled },
  });
  return res.json({ ok: true });
}

export async function platformStats(req: AuthRequest, res: Response) {
  if (!requireSuperAdmin(req, res)) return;
  const stats = await adminOrg.platformStats();
  return res.json(stats);
}
