import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as foodcostService from '../modules/foodcost/service.js';

export async function forecast(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await foodcostService.getFoodcostForecast(organizationId);
    res.json({ forecast: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get foodcost forecast' });
  }
}
