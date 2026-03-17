import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';
const r = Router();
r.use(requireModule('foodcost'));
r.get('/status', (_req, res) => res.json({ module: 'foodcost', ok: true }));
export default r;
