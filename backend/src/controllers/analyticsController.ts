import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as analyticsModel from '../models/analyticsModel.js';
import * as anomaliesModel from '../models/anomaliesModel.js';
import { logger } from '../utils/logger.js';
import { forecastPriceForProduct } from '../services/priceForecastService.js';

function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization context required' });
    return null;
  }
  return orgId;
}

export async function priceForecast(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const productId = req.query.product_id as string;
    if (!productId) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    const horizonRaw = req.query.horizon_days ? parseInt(String(req.query.horizon_days), 10) : 14;
    const horizonDays = Number.isFinite(horizonRaw) && horizonRaw > 0 ? horizonRaw : 14;
    const result = await forecastPriceForProduct({
      organizationId: orgId,
      productId,
      horizonDays,
    });
    return res.json(result);
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 404) return res.status(404).json({ error: 'Product not found' });
    logger.error({ err }, 'priceForecast failed');
    return res.status(500).json({ error: 'Failed to forecast price' });
  }
}

export async function priceHistory(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const productId = req.query.product_id as string;
    if (!productId) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    const dateTo = req.query.date_to ? new Date(String(req.query.date_to)) : new Date();
    const dateFrom = req.query.date_from
      ? new Date(String(req.query.date_from))
      : new Date(dateTo.getTime() - 90 * 24 * 60 * 60 * 1000);
    const supplierId = req.query.supplier_id ? String(req.query.supplier_id) : null;

    const data = await analyticsModel.getPriceHistory({
      organizationId: orgId,
      productId,
      dateFrom,
      dateTo,
      supplierId,
    });
    return res.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 404) return res.status(404).json({ error: 'Product not found' });
    logger.error({ err }, 'priceHistory failed');
    return res.status(500).json({ error: 'Failed to load price history' });
  }
}

export async function bestSuppliers(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const productId = req.query.product_id ? String(req.query.product_id) : null;
    const period_days = req.query.period_days ? parseInt(String(req.query.period_days), 10) : 90;
    const days = Number.isFinite(period_days) && period_days > 0 ? Math.min(period_days, 730) : 90;

    const data = await analyticsModel.getBestSuppliers({
      organizationId: orgId,
      productId,
      periodDays: days,
    });
    return res.json(data);
  } catch (err) {
    logger.error({ err }, 'bestSuppliers failed');
    return res.status(500).json({ error: 'Failed to load supplier ranking' });
  }
}

export async function priceSummary(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const period_days = req.query.period_days ? parseInt(String(req.query.period_days), 10) : 30;
    const days = Number.isFinite(period_days) && period_days > 0 ? Math.min(period_days, 730) : 30;

    const data = await analyticsModel.getPriceSummary({
      organizationId: orgId,
      periodDays: days,
    });
    return res.json(data);
  } catch (err) {
    logger.error({ err }, 'priceSummary failed');
    return res.status(500).json({ error: 'Failed to load summary' });
  }
}

export async function listAnomalies(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const severity = req.query.severity as 'low' | 'medium' | 'high' | undefined;
    let acknowledged: boolean | undefined;
    if (req.query.acknowledged === 'true') acknowledged = true;
    if (req.query.acknowledged === 'false') acknowledged = false;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const dateFrom = req.query.date_from ? new Date(String(req.query.date_from)) : undefined;
    const dateTo = req.query.date_to ? new Date(String(req.query.date_to)) : undefined;

    const rows = await anomaliesModel.listAnomalies({
      organizationId: orgId,
      severity: severity && ['low', 'medium', 'high'].includes(severity) ? severity : undefined,
      acknowledged,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
    return res.json({ anomalies: rows });
  } catch (err) {
    logger.error({ err }, 'listAnomalies failed');
    return res.status(500).json({ error: 'Failed to list anomalies' });
  }
}

export async function unreadAnomaliesCount(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const count = await anomaliesModel.countUnread(orgId);
    return res.json({ count });
  } catch (err) {
    logger.error({ err }, 'unreadAnomaliesCount failed');
    return res.status(500).json({ error: 'Failed to count anomalies' });
  }
}

export async function acknowledgeAnomaly(req: AuthRequest, res: Response) {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const ok = await anomaliesModel.acknowledgeAnomaly(id, orgId, userId);
    if (!ok) return res.status(404).json({ error: 'Anomaly not found' });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'acknowledgeAnomaly failed');
    return res.status(500).json({ error: 'Failed to acknowledge' });
  }
}
