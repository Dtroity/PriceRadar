import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import * as authController from '../controllers/authController.js';
import * as suppliersController from '../controllers/suppliersController.js';
import * as productsController from '../controllers/productsController.js';
import * as priceChangesController from '../controllers/priceChangesController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as telegramController from '../controllers/telegramController.js';
import { uploadMiddleware, ensureUploadDir } from '../middleware/upload.js';
const router = Router();
// Auth (public)
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
// Protected
router.use(authMiddleware);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);
router.get('/suppliers', suppliersController.list);
router.get('/products', productsController.list);
router.patch('/products/:id/priority', productsController.setPriority);
router.get('/price-changes', priceChangesController.list);
router.get('/products/:productId/price-history', priceChangesController.priceHistory);
// Upload: ensure dir then multer then handler
router.post('/upload', async (req, res, next) => {
    await ensureUploadDir();
    uploadMiddleware(req, res, (err) => {
        if (err)
            return res.status(400).json({ error: err.message });
        next();
    });
}, uploadController.upload);
// Telegram (admin only for management)
router.get('/telegram/status', telegramController.getBotStatus);
router.get('/telegram/users', requireRole('admin'), telegramController.listUsers);
router.patch('/telegram/users/:telegramId/allow', requireRole('admin'), telegramController.allowUser);
router.delete('/telegram/users/:id', requireRole('admin'), telegramController.removeUser);
export default router;
