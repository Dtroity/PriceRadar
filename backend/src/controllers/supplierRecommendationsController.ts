import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as supplierIntelligence from '../modules/supplier-intelligence/service.js';

export async function recommendations(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const productId = req.query.product_id as string;
    if (!productId) return res.status(400).json({ error: 'product_id required' });
    const out = await supplierIntelligence.getRecommendations(organizationId, productId);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
}
