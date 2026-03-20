import { Router } from 'express';
import { authMiddleware, requireRole, type AuthRequest } from '../auth/middleware.js';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/authController.js';
import * as suppliersController from '../controllers/suppliersController.js';
import * as productsController from '../controllers/productsController.js';
import * as priceChangesController from '../controllers/priceChangesController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as telegramController from '../controllers/telegramController.js';
import * as documentsController from '../controllers/documentsController.js';
import * as recipesController from '../controllers/recipesController.js';
import * as aiController from '../controllers/aiController.js';
import * as supplierRecommendationsController from '../controllers/supplierRecommendationsController.js';
import * as foodcostController from '../controllers/foodcostController.js';
import * as priceTrendController from '../controllers/priceTrendController.js';
import * as documentMetricsController from '../controllers/documentMetricsController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import { sentryUserMiddleware } from '../middleware/sentryUserMiddleware.js';
import { uploadMiddleware, ensureUploadDir } from '../middleware/upload.js';
import { mountModuleRoutes } from '../modules/registry.js';
import { requireModule } from '../modules/_shared/requireModule.js';
import { validateBody } from '../middleware/validation.js';
import { pool } from '../db/pool.js';
import { checkRedisConnection } from '../db/redis.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['super_admin', 'org_admin', 'manager']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerOrgSchema = z.object({
  organizationName: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginOrgSchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const telegramAllowSchema = z.object({
  isAllowed: z.boolean(),
});

const productsNormalizeSchema = z.object({
  rawNames: z.array(z.string().min(1)).min(1),
  targetNormalizedName: z.string().min(1),
});

const productsMergeSchema = z.object({
  sourceProductIds: z.array(z.string().uuid()).min(1),
  targetProductId: z.string().uuid(),
});

type RouteDescriptor = {
  method: string;
  path: string;
  roles: string[];
  module?: string;
};

function listRegisteredRoutes(): RouteDescriptor[] {
  const out: RouteDescriptor[] = [];
  const stack = (router as unknown as { stack?: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle?: unknown }> } }> }).stack ?? [];

  for (const layer of stack) {
    if (!layer.route) continue;
    const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
    const roles = new Set<string>();
    let requiredModule: string | undefined;

    for (const routeLayer of layer.route.stack) {
      const handle = routeLayer.handle as
        | { requiredRoles?: string[]; requiredModule?: string }
        | undefined;
      if (Array.isArray(handle?.requiredRoles)) {
        handle.requiredRoles.forEach((r) => roles.add(r));
      }
      if (handle?.requiredModule) {
        requiredModule = handle.requiredModule;
      }
    }

    for (const method of methods) {
      out.push({
        method,
        path: `/api${layer.route.path}`,
        roles: [...roles],
        module: requiredModule,
      });
    }
  }

  return out;
}

// Healthcheck (public diagnostics)
router.get('/health', async (_req, res) => {
  let db = 'disconnected';
  let redis = 'disconnected';
  try {
    await pool.query('SELECT 1');
    db = 'connected';
  } catch {
    db = 'disconnected';
  }
  try {
    await checkRedisConnection();
    redis = 'connected';
  } catch {
    redis = 'disconnected';
  }

  const ok = db === 'connected' && redis === 'connected';
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db,
    redis,
  });
});

// Auth (public)
router.post('/auth/register', validateBody(registerSchema), authController.register as unknown as RequestHandler);
router.post('/auth/login', validateBody(loginSchema), authController.login as unknown as RequestHandler);
router.post('/auth/register-org', validateBody(registerOrgSchema), authController.registerOrg as unknown as RequestHandler);
router.post('/auth/login-org', validateBody(loginOrgSchema), authController.loginWithOrg as unknown as RequestHandler);
router.post('/auth/refresh', validateBody(refreshSchema), authController.refresh as unknown as RequestHandler);

// Protected
router.use(authMiddleware);
router.use(sentryUserMiddleware);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);
router.get('/debug/routes', requireRole('super_admin'), (_req, res) => {
  return res.json({ routes: listRegisteredRoutes() });
});

router.get('/suppliers', suppliersController.list);
router.get('/suppliers/recommendations', requireModule('supplier_intelligence'), supplierRecommendationsController.recommendations);
router.get('/products', productsController.list);
router.get(
  '/products/duplicates',
  requireRole(['super_admin', 'org_admin']),
  productsController.getDuplicates
);
router.post(
  '/products/auto-merge',
  requireRole(['super_admin', 'org_admin']),
  productsController.postAutoMerge
);
router.get('/products/normalize', productsController.listNormalizationCandidates);
router.post('/products/normalize', validateBody(productsNormalizeSchema), productsController.normalizeProducts);
router.post(
  '/products/merge',
  requireRole(['super_admin', 'org_admin']),
  validateBody(productsMergeSchema),
  productsController.mergeProducts
);
router.get('/products/:id/history', productsController.getProductHistory);
router.patch('/products/:id/priority', productsController.setPriority);

// Price analytics (org context required)
router.get('/analytics/prices/history', analyticsController.priceHistory);
router.get('/analytics/prices/best-suppliers', analyticsController.bestSuppliers);
router.get('/analytics/prices/summary', analyticsController.priceSummary);
router.get('/analytics/anomalies', analyticsController.listAnomalies);
router.get('/analytics/anomalies/unread-count', analyticsController.unreadAnomaliesCount);
router.patch('/analytics/anomalies/:id/acknowledge', analyticsController.acknowledgeAnomaly);
router.get('/price-changes', requireModule('price_monitoring'), priceChangesController.list);
router.get('/products/:productId/price-history', requireModule('price_monitoring'), priceChangesController.priceHistory);

// Upload: ensure dir then multer then handler
router.post('/upload', requireModule('price_monitoring'), async (req, res, next) => {
  await ensureUploadDir();
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, uploadController.upload);

// Documents (invoices): upload -> AI parse; list, get, patch item, confirm
router.post('/documents/upload', requireModule('invoice_ai'), async (req, res, next) => {
  await ensureUploadDir();
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, documentsController.upload);
router.get('/documents', requireModule('invoice_ai'), documentsController.list);
router.get('/documents/:id', requireModule('invoice_ai'), documentsController.getById);
router.patch('/documents/:id/items/:itemId', requireModule('invoice_ai'), documentsController.patchItem);
router.post('/documents/:id/confirm', requireModule('invoice_ai'), documentsController.confirm);

// FoodCost
router.get('/recipes', requireModule('foodcost'), recipesController.list);
router.post('/recipes/:id/consume', requireModule('foodcost'), recipesController.consume);
router.get('/foodcost/forecast', requireModule('foodcost'), foodcostController.forecast);

// Product price trend
router.get('/products/:id/price-trend', requireModule('price_monitoring'), priceTrendController.priceTrend);

// Document quality metrics
router.get('/metrics/documents', requireModule('invoice_ai'), documentMetricsController.documentMetrics);

// AI learning
router.post('/ai/training-dataset', requireModule('invoice_ai'), aiController.trainingDataset);

// Modular SaaS routes (registry)
mountModuleRoutes(router);

// Telegram (admin only for management)
router.get('/telegram/status', requireModule('telegram_bot'), telegramController.getBotStatus);
router.get('/telegram/users', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), telegramController.listUsers);
router.patch('/telegram/users/:telegramId/allow', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), validateBody(telegramAllowSchema), telegramController.allowUser);
router.delete('/telegram/users/:id', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), telegramController.removeUser);

export default router;
