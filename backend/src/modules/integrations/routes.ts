import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';
const r = Router();
r.use(requireModule('iiko_integration'));
r.get('/status', (_req, res) => res.json({ module: 'iiko_integration', ok: true }));
export default r;
