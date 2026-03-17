import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { requireModule } from '../_shared/requireModule.js';
import * as repo from './repository.js';

const router = Router();
router.use(requireModule('procurement_autopilot'));

router.get('/settings', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const settings = await repo.getOrganizationSettings(orgId);
  res.json(settings);
});

router.put('/settings', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const { autopilot_mode, autopilot_days_threshold } = req.body as {
    autopilot_mode?: string;
    autopilot_days_threshold?: number;
  };
  const current = await repo.getOrganizationSettings(orgId);
  const mode = ['disabled', 'recommend_only', 'auto_generate', 'auto_send'].includes(autopilot_mode ?? '')
    ? autopilot_mode!
    : current.autopilot_mode;
  const threshold = typeof autopilot_days_threshold === 'number' ? autopilot_days_threshold : (current.autopilot_days_threshold ?? 3);
  await repo.upsertOrganizationSettings(orgId, mode, threshold);
  res.json({ autopilot_mode: mode, autopilot_days_threshold: threshold });
});

export default router;
