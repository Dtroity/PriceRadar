import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { requireModule } from '../_shared/requireModule.js';
import * as repo from './repository.js';
import * as stockService from './stockService.js';

const router = Router();
router.use(requireModule('stock'));

router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const items = await repo.listStock(orgId);
  const withAnalytics = await Promise.all(
    items.map(async (row: { product_id: string; current_stock: number; product_name: string; unit: string | null }) => {
      const daily = await repo.getConsumptionFromRecipeUsage(orgId, row.product_id, 14);
      const daysRemaining = daily > 0 ? Number(row.current_stock) / daily : 999;
      return {
        product: row.product_name,
        product_id: row.product_id,
        current_stock: Number(row.current_stock),
        unit: row.unit,
        daily_consumption: daily,
        days_remaining: Math.round(daysRemaining * 10) / 10,
      };
    })
  );
  res.json({ stock: withAnalytics });
});

router.get('/forecast', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const forecast = await stockService.getStockForecast(orgId);
  res.json({ forecast });
});

export default router;
