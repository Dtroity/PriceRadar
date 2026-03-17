import { Router } from 'express';
import { authMiddleware, requireRole, type AuthRequest } from '../auth/middleware.js';
import * as authController from '../controllers/authController.js';
import * as suppliersController from '../controllers/suppliersController.js';
import * as productsController from '../controllers/productsController.js';
import * as priceChangesController from '../controllers/priceChangesController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as telegramController from '../controllers/telegramController.js';
import * as documentsController from '../controllers/documentsController.js';
import * as metricsController from '../controllers/metricsController.js';
import * as recipesController from '../controllers/recipesController.js';
import * as aiController from '../controllers/aiController.js';
import * as supplierRecommendationsController from '../controllers/supplierRecommendationsController.js';
import * as foodcostController from '../controllers/foodcostController.js';
import * as priceTrendController from '../controllers/priceTrendController.js';
import * as documentMetricsController from '../controllers/documentMetricsController.js';
import { uploadMiddleware, ensureUploadDir } from '../middleware/upload.js';
import { mountModuleRoutes } from '../modules/registry.js';
import { requireModule } from '../modules/_shared/requireModule.js';

const router = Router();

// Metrics (no auth, for Prometheus)
router.get('/metrics/prometheus', metricsController.prometheus);

// Auth (public)
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/register-org', authController.registerOrg);
router.post('/auth/login-org', authController.loginWithOrg);
router.post('/auth/refresh', authController.refresh);

// Protected
router.use(authMiddleware);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);

router.get('/suppliers', suppliersController.list);
router.get('/suppliers/recommendations', requireModule('supplier_intelligence'), supplierRecommendationsController.recommendations);
router.get('/products', productsController.list);
router.patch('/products/:id/priority', productsController.setPriority);
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
router.get('/telegram/users', requireModule('telegram_bot'), requireRole('admin', 'owner'), telegramController.listUsers);
router.patch('/telegram/users/:telegramId/allow', requireModule('telegram_bot'), requireRole('admin', 'owner'), telegramController.allowUser);
router.delete('/telegram/users/:id', requireModule('telegram_bot'), requireRole('admin', 'owner'), telegramController.removeUser);

export default router;
