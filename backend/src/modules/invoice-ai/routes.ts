import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';
const r = Router();
r.use(requireModule('invoice_ai'));
r.get('/status', (_req, res) => res.json({ module: 'invoice_ai', ok: true }));
export default r;
