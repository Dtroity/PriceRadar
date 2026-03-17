import type { Request, Response } from 'express';
import * as priceChangesModel from '../models/priceChanges.js';
import type { AuthRequest } from '../auth/middleware.js';
import { config } from '../config.js';

export async function list(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    const supplierId = req.query.supplierId as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const minPercent = req.query.minPercent != null ? Number(req.query.minPercent) : undefined;
    const maxPercent = req.query.maxPercent != null ? Number(req.query.maxPercent) : undefined;
    const priorityOnly = req.query.priorityOnly === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const organizationId = config.multiTenant ? authReq.user?.organizationId : undefined;
    const changes = await priceChangesModel.getPriceChanges(
      { organizationId, supplierId, fromDate, toDate, minPercent, maxPercent, priorityOnly },
      limit
    );
    return res.json({ changes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch price changes' });
  }
}

export async function priceHistory(req: Request, res: Response) {
  try {
    const productId = req.params.productId;
    const supplierId = req.query.supplierId as string | undefined;
    const history = await priceChangesModel.getPriceHistory(productId, supplierId);
    return res.json({ history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch price history' });
  }
}
