import { Router } from 'express';
import { requireModule } from '../_shared/requireModule.js';
const r = Router();
r.use(requireModule('forecast'));
r.get('/status', (_req, res) => res.json({ module: 'forecast', ok: true }));
export default r;
