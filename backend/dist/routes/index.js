import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import * as authController from '../controllers/authController.js';
import * as suppliersController from '../controllers/suppliersController.js';
import * as productsController from '../controllers/productsController.js';
import * as priceChangesController from '../controllers/priceChangesController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as uploadJobController from '../controllers/uploadJobController.js';
import * as ingestionController from '../controllers/ingestionController.js';
import * as telegramController from '../controllers/telegramController.js';
import * as documentsController from '../controllers/documentsController.js';
import * as recipesController from '../controllers/recipesController.js';
import * as aiController from '../controllers/aiController.js';
import * as supplierRecommendationsController from '../controllers/supplierRecommendationsController.js';
import * as foodcostController from '../controllers/foodcostController.js';
import * as priceTrendController from '../controllers/priceTrendController.js';
import * as documentMetricsController from '../controllers/documentMetricsController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as procurementController from '../controllers/procurementController.js';
import * as dispatchesController from '../controllers/dispatchesController.js';
import * as iikoIntegrationController from '../controllers/iikoIntegrationController.js';
import * as adminController from '../controllers/adminController.js';
import * as notificationsController from '../controllers/notificationsController.js';
import * as publicOrderController from '../controllers/publicOrderController.js';
import { sentryUserMiddleware } from '../middleware/sentryUserMiddleware.js';
import { uploadMiddleware, ensureUploadDir } from '../middleware/upload.js';
import { mountModuleRoutes } from '../modules/registry.js';
import { requireModule } from '../modules/_shared/requireModule.js';
import { validateBody } from '../middleware/validation.js';
import { MergeProductsSchema, NormalizeProductsSchema } from '../validators/products.js';
import { AddItemSchema, CreateOrderSchema, PatchItemSchema, PatchOrderHeaderSchema, UpdateOrderStatusSchema, } from '../validators/procurement.js';
import { ConfirmDocumentSchema } from '../validators/documents.js';
import { pool } from '../db/pool.js';
import { checkRedisConnection } from '../db/redis.js';
import { z } from 'zod';
const router = Router();
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['super_admin', 'org_admin', 'manager', 'employee', 'supplier']).optional(),
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
    industry: z.string().max(80).optional(),
});
const adminCreateOrgSchema = z.object({
    name: z.string().min(1),
    plan: z.enum(['free', 'pro', 'enterprise']).optional(),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(6),
});
const adminPatchOrgSchema = z
    .object({
    plan: z.enum(['free', 'pro', 'enterprise']).optional(),
    is_active: z.boolean().optional(),
    max_users: z.number().int().positive().optional(),
    max_documents_mo: z.number().int().positive().optional(),
    notes: z.string().nullable().optional(),
    plan_expires_at: z.string().nullable().optional(),
})
    .strict();
const adminPatchModuleSchema = z
    .object({
    module: z.string().min(1),
    enabled: z.boolean(),
})
    .strict();
const notificationsPatchSchema = z
    .object({
    notify_email: z.string().email().nullable().optional(),
    notify_email_enabled: z.boolean().optional(),
    vk_notify_phone: z.string().max(32).nullable().optional(),
    vk_notify_enabled: z.boolean().optional(),
    webpush_enabled: z.boolean().optional(),
    notify_events: z
        .object({
        anomaly_high: z.boolean().optional(),
        anomaly_medium: z.boolean().optional(),
        recommendation: z.boolean().optional(),
        order_status: z.boolean().optional(),
        price_report_weekly: z.boolean().optional(),
    })
        .optional(),
})
    .strict();
const webpushSubscribeSchema = z
    .object({
    endpoint: z.string().min(1),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
})
    .strict();
const webpushDeleteSchema = z
    .object({
    endpoint: z.string().min(1).optional(),
    id: z.string().uuid().optional(),
})
    .strict()
    .refine((d) => d.endpoint || d.id, { message: 'endpoint or id required' });
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
function listRegisteredRoutes() {
    const out = [];
    const stack = router.stack ?? [];
    for (const layer of stack) {
        if (!layer.route)
            continue;
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        const roles = new Set();
        let requiredModule;
        for (const routeLayer of layer.route.stack) {
            const handle = routeLayer.handle;
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
    }
    catch {
        db = 'disconnected';
    }
    try {
        await checkRedisConnection();
        redis = 'connected';
    }
    catch {
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
router.post('/auth/register', validateBody(registerSchema), authController.register);
router.post('/auth/login', validateBody(loginSchema), authController.login);
router.post('/auth/register-org', validateBody(registerOrgSchema), authController.registerOrg);
router.post('/auth/login-org', validateBody(loginOrgSchema), authController.loginWithOrg);
router.post('/auth/refresh', validateBody(refreshSchema), authController.refresh);
// Supplier portal (public; no auth)
router.get('/public/order/:token', publicOrderController.getOrder);
router.post('/public/order/:token/accept', publicOrderController.acceptOrder);
router.post('/public/order/:token/reject', publicOrderController.rejectOrder);
router.get('/public/order/:token/messages', publicOrderController.getMessages);
router.post('/public/order/:token/messages', publicOrderController.sendMessage);
// Protected
router.use(authMiddleware);
router.use(sentryUserMiddleware);
// Employee is a restricted role (restaurant staff): allow only products + own procurement create/list.
router.use((req, res, next) => {
    const r = req.user?.role;
    if (r !== 'employee')
        return next();
    const method = req.method.toUpperCase();
    const p = req.path; // path without "/api" prefix (router mounted at /api)
    const ok = (method === 'GET' && p === '/auth/me') ||
        (method === 'POST' && p === '/auth/logout') ||
        (method === 'GET' && p === '/products') ||
        (method === 'GET' && p === '/procurement/orders') ||
        (method === 'POST' && p === '/procurement/orders') ||
        (method === 'GET' && /^\/procurement\/orders\/[^/]+$/.test(p)) ||
        (method === 'GET' && p === '/ingestion') ||
        (method === 'GET' && /^\/ingestion\/[^/]+$/.test(p)) ||
        (method === 'POST' && p === '/ingestion/init') ||
        (method === 'POST' && /^\/ingestion\/[^/]+\/confirm$/.test(p)) ||
        (method === 'POST' && /^\/ingestion\/[^/]+\/duplicate-decision$/.test(p)) ||
        (method === 'DELETE' && /^\/ingestion\/[^/]+$/.test(p)) ||
        (method === 'GET' && /^\/upload\/jobs\/[^/]+$/.test(p));
    if (!ok)
        return res.status(403).json({ error: 'Forbidden' });
    return next();
});
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);
router.get('/debug/routes', requireRole('super_admin'), (_req, res) => {
    return res.json({ routes: listRegisteredRoutes() });
});
// Super-admin SaaS
router.get('/admin/organizations', requireRole('super_admin'), adminController.listOrganizations);
router.get('/admin/organizations/:id', requireRole('super_admin'), adminController.getOrganization);
router.post('/admin/organizations', requireRole('super_admin'), validateBody(adminCreateOrgSchema), adminController.createOrganization);
router.patch('/admin/organizations/:id', requireRole('super_admin'), validateBody(adminPatchOrgSchema), adminController.patchOrganization);
router.get('/admin/organizations/:id/modules', requireRole('super_admin'), adminController.listOrgModules);
router.patch('/admin/organizations/:id/modules', requireRole('super_admin'), validateBody(adminPatchModuleSchema), adminController.patchOrgModule);
router.get('/admin/stats', requireRole('super_admin'), adminController.platformStats);
// Notifications (org)
router.get('/notifications/settings', notificationsController.getSettings);
router.patch('/notifications/settings', validateBody(notificationsPatchSchema), notificationsController.patchSettings);
router.get('/notifications/settings/matrix', notificationsController.getMatrix);
router.put('/notifications/settings/matrix', notificationsController.putMatrix);
router.post('/notifications/test', notificationsController.postTest);
router.post('/notifications/webpush/subscribe', validateBody(webpushSubscribeSchema), notificationsController.postWebPushSubscribe);
router.delete('/notifications/webpush/subscribe', validateBody(webpushDeleteSchema), notificationsController.deleteWebPushSubscribe);
router.get('/notifications/vapid-public-key', notificationsController.getVapidPublicKey);
router.get('/suppliers', suppliersController.list);
router.post('/suppliers', requireRole(['super_admin', 'org_admin', 'manager']), suppliersController.createSupplier);
router.patch('/suppliers/:id', requireRole(['super_admin', 'org_admin']), suppliersController.patchSupplier);
router.get('/suppliers/:id/filters', requireRole(['super_admin', 'org_admin', 'manager']), suppliersController.listSupplierFilters);
router.post('/suppliers/:id/filters', requireRole(['super_admin', 'org_admin', 'manager']), suppliersController.addSupplierFilter);
router.delete('/suppliers/:id/filters/:filterId', requireRole(['super_admin', 'org_admin', 'manager']), suppliersController.deleteSupplierFilter);
router.post('/suppliers/:id/invite', requireRole(['super_admin', 'org_admin']), suppliersController.inviteSupplier);
router.get('/suppliers/recommendations', requireModule('supplier_intelligence'), supplierRecommendationsController.recommendations);
router.get('/products', productsController.list);
router.get('/products/duplicates', requireRole(['super_admin', 'org_admin']), productsController.getDuplicates);
router.post('/products/auto-merge', requireRole(['super_admin', 'org_admin']), productsController.postAutoMerge);
router.get('/products/normalize', productsController.listNormalizationCandidates);
router.post('/products/normalize', validateBody(NormalizeProductsSchema), productsController.normalizeProducts);
router.post('/products/merge', requireRole(['super_admin', 'org_admin']), validateBody(MergeProductsSchema), productsController.mergeProducts);
router.get('/products/:id/history', productsController.getProductHistory);
router.patch('/products/:id/priority', productsController.setPriority);
// Price analytics (org context required)
router.get('/analytics/prices/history', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.priceHistory);
router.get('/analytics/prices/forecast', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.priceForecast);
router.get('/analytics/prices/best-suppliers', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.bestSuppliers);
router.get('/analytics/prices/summary', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.priceSummary);
router.get('/analytics/anomalies', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.listAnomalies);
router.get('/analytics/anomalies/unread-count', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.unreadAnomaliesCount);
router.patch('/analytics/anomalies/:id/acknowledge', requireRole(['super_admin', 'org_admin', 'manager']), analyticsController.acknowledgeAnomaly);
// Procurement (заявки и рекомендации закупок)
const procurementRoles = ['super_admin', 'org_admin', 'manager'];
const procurementEmployeeRoles = ['super_admin', 'org_admin', 'manager', 'employee'];
router.get('/procurement/orders', requireRole(procurementEmployeeRoles), procurementController.listOrders);
router.post('/procurement/orders', requireRole(procurementEmployeeRoles), validateBody(CreateOrderSchema), procurementController.createOrder);
router.get('/procurement/orders/:id', requireRole(procurementEmployeeRoles), procurementController.getOrder);
router.get('/procurement/orders/:id/dispatches', requireRole(procurementRoles), dispatchesController.listOrderDispatches);
router.patch('/procurement/orders/:id', requireRole(procurementRoles), validateBody(PatchOrderHeaderSchema), procurementController.patchOrder);
router.patch('/procurement/orders/:id/status', requireRole(procurementRoles), validateBody(UpdateOrderStatusSchema), procurementController.patchOrderStatus);
router.post('/procurement/orders/:id/items', requireRole(procurementRoles), validateBody(AddItemSchema), procurementController.addItem);
router.patch('/procurement/orders/:id/items/:itemId', requireRole(procurementRoles), validateBody(PatchItemSchema), procurementController.patchItem);
router.delete('/procurement/orders/:id/items/:itemId', requireRole(procurementRoles), procurementController.deleteItem);
router.get('/procurement/price-hint', requireRole(procurementRoles), procurementController.priceHint);
router.get('/procurement/recommendations', requireRole(procurementRoles), procurementController.listRecommendations);
router.get('/procurement/dispatches/:dispatchId/messages', requireRole(procurementRoles), dispatchesController.getDispatchMessages);
router.post('/procurement/dispatches/:dispatchId/messages', requireRole(procurementRoles), dispatchesController.postDispatchMessage);
router.post('/procurement/dispatches/:dispatchId/resend', requireRole(procurementRoles), dispatchesController.resendDispatch);
router.post('/procurement/recommendations/generate', requireRole(procurementRoles), procurementController.runGenerateRecommendations);
router.patch('/procurement/recommendations/:id/accept', requireRole(procurementRoles), procurementController.acceptRecommendation);
router.patch('/procurement/recommendations/:id/dismiss', requireRole(procurementRoles), procurementController.dismissRecommendation);
// iiko (организация)
router.post('/integrations/iiko/sync', requireModule('iiko_integration'), requireRole(['org_admin', 'super_admin']), iikoIntegrationController.postSync);
router.get('/integrations/iiko/status', requireModule('iiko_integration'), requireRole(['org_admin', 'super_admin', 'manager']), iikoIntegrationController.getStatus);
router.patch('/integrations/iiko/settings', requireModule('iiko_integration'), requireRole(['org_admin', 'super_admin']), iikoIntegrationController.patchSettings);
router.get('/price-changes', requireModule('price_monitoring'), priceChangesController.list);
router.get('/products/:productId/price-history', requireModule('price_monitoring'), priceChangesController.priceHistory);
// Upload: ensure dir then multer then handler
router.post('/upload', requireModule('price_monitoring'), async (req, res, next) => {
    await ensureUploadDir();
    uploadMiddleware(req, res, (err) => {
        if (err)
            return res.status(400).json({ error: err.message });
        next();
    });
}, uploadController.upload);
router.get('/upload/jobs/:jobId', requireModule('price_monitoring'), uploadJobController.getJobStatus);
// Unified ingestion: classify → optional confirm → price list or document pipeline (сотрудники — только загрузка/журнал)
const ingestionRoles = ['super_admin', 'org_admin', 'manager', 'employee'];
router.post('/ingestion/init', requireRole(ingestionRoles), async (req, res, next) => {
    await ensureUploadDir();
    uploadMiddleware(req, res, (err) => {
        if (err)
            return res.status(400).json({ error: err.message });
        next();
    });
}, ingestionController.postInit);
router.post('/ingestion/:id/confirm', requireRole(ingestionRoles), ingestionController.postConfirm);
router.post('/ingestion/:id/duplicate-decision', requireRole(ingestionRoles), ingestionController.postDuplicateDecision);
router.get('/ingestion', requireRole(ingestionRoles), ingestionController.list);
router.get('/ingestion/:id', requireRole(ingestionRoles), ingestionController.getOne);
router.delete('/ingestion/:id', requireRole(ingestionRoles), ingestionController.remove);
// Documents (invoices): upload -> AI parse; list, get, patch item, confirm
router.post('/documents/upload', requireModule('invoice_ai'), async (req, res, next) => {
    await ensureUploadDir();
    uploadMiddleware(req, res, (err) => {
        if (err)
            return res.status(400).json({ error: err.message });
        next();
    });
}, documentsController.upload);
router.get('/documents', requireModule('invoice_ai'), documentsController.list);
router.get('/documents/:id', requireModule('invoice_ai'), documentsController.getById);
router.patch('/documents/:id/items/:itemId', requireModule('invoice_ai'), documentsController.patchItem);
router.post('/documents/:id/confirm', requireModule('invoice_ai'), validateBody(ConfirmDocumentSchema), documentsController.confirm);
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
router.get('/telegram/org-settings', requireModule('telegram_bot'), requireRole(['org_admin', 'super_admin']), telegramController.getOrgNotifySettings);
router.patch('/telegram/org-settings', requireModule('telegram_bot'), requireRole(['org_admin', 'super_admin']), telegramController.patchOrgNotifySettings);
router.post('/telegram/test', requireModule('telegram_bot'), requireRole(['org_admin', 'super_admin']), telegramController.postTestMessage);
router.get('/telegram/users', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), telegramController.listUsers);
router.patch('/telegram/users/:telegramId/allow', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), validateBody(telegramAllowSchema), telegramController.allowUser);
router.delete('/telegram/users/:id', requireModule('telegram_bot'), requireRole(['super_admin', 'org_admin']), telegramController.removeUser);
export default router;
