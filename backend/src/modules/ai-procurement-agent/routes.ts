import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { requireModule } from '../_shared/requireModule.js';
import * as agentRepo from './repository.js';
import * as agentService from './service.js';

const router = Router();
router.use(requireModule('ai_procurement_agent'));

router.post('/recommendations', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId!;
    const input: import('./types.js').ProcurementRecommendationInput = {
      product_prices: Array.isArray(req.body?.product_prices) ? req.body.product_prices : [],
      price_forecasts: req.body?.price_forecasts,
      stock_levels: req.body?.stock_levels,
      supplier_prices: req.body?.supplier_prices,
      consumption_rates: req.body?.consumption_rates,
    };
    if (!input.product_prices.length && !input.supplier_prices?.length) {
      const prices = await agentRepo.latestPricesForOrg(orgId);
      input.supplier_prices = prices.map((r: { product_id: string; price: number; supplier_id: string }) => ({
        product_id: r.product_id,
        price: Number(r.price),
        supplier_id: r.supplier_id,
      }));
    }
    const out = await agentService.fetchRecommendations(input);
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Procurement AI unavailable' });
  }
});

export default router;
