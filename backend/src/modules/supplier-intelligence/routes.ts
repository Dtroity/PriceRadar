import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';

const r = Router();
r.use(requireModule('supplier_intelligence'));
r.get('/status', (_req, res) => res.json({ module: 'supplier_intelligence', ok: true }));
export default r;
