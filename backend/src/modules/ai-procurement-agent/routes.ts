import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { requireModule } from '../_shared/requireModule.js';
import * as agentRepo from './repository.js';
import * as procurementRecs from '../../models/procurementRecommendationsModel.js';
import { enrichRecommendationsWithAI } from '../../services/aiProcurementAgent.js';

const router = Router();
router.use(requireModule('ai_procurement_agent'));

router.post('/recommendations', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId!;
    const hasYandex = Boolean(process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID);

    if (hasYandex) {
      const recommendations = await enrichRecommendationsWithAI(orgId);
      return res.json({ recommendations, source: 'yandex' });
    }

    const recs = await procurementRecs.listActive(orgId);
    return res.json({
      recommendations: recs.map((r) => ({
        ...r,
        ai_explanation: null,
        ai_priority: r.priority,
      })),
      source: 'rule_based',
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Procurement AI unavailable' });
  }
});

export default router;
