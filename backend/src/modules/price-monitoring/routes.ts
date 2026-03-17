import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';
const r = Router();
r.use(requireModule('price_monitoring'));
r.get('/status', (_req, res) => res.json({ module: 'price_monitoring', ok: true }));
export default r;
