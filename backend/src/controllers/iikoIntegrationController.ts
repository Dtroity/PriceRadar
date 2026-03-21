import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as orgSettings from '../models/organizationsSettingsModel.js';
import { syncIikoNomenclature, lastIikoSyncStatus } from '../services/iikoSync.js';
import { iikoSyncQueue } from '../workers/iikoSyncWorker.js';

function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization required' });
    return null;
  }
  return orgId;
}

export async function postSync(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = req.body as { iikoOrganizationId?: string };
  const result = await syncIikoNomenclature(orgId, body.iikoOrganizationId);
  return res.json({
    created: result.created,
    updated: result.updated,
    errors: result.errors,
  });
}

export async function getStatus(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const last = await lastIikoSyncStatus(orgId);
  return res.json({ last_sync: last });
}

export async function patchSettings(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = req.body as { iiko_api_url?: string | null; iiko_api_key?: string | null };
  await orgSettings.saveIikoOrgSettings(orgId, body);
  return res.json({ ok: true });
}

export async function queueSync(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const cred = await orgSettings.getIikoCredentials(orgId);
  if (!cred.iiko_api_url) return res.status(400).json({ error: 'iiko not configured' });
  await iikoSyncQueue.add('sync', { organizationId: orgId });
  return res.status(202).json({ queued: true });
}
