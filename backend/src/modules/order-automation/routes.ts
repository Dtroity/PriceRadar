import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../../auth/middleware.js';
import { requireModule } from '../_shared/requireModule.js';
import * as repo from './repository.js';
import * as service from './service.js';
import type { SendOrderJobPayload } from './types.js';

const router = Router();
router.use(requireModule('order_automation'));

router.get('/orders', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const orders = await repo.listOrders(orgId);
  res.json({ orders });
});

router.get('/orders/:id', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const order = await repo.getOrder(req.params.id, orgId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const items = await repo.getOrderItems(order.id);
  res.json({ ...order, items });
});

router.post('/orders', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const userId = req.user!.userId ?? null;
  const { supplier_id, notes, items } = req.body as {
    supplier_id: string;
    notes?: string;
    items: { product_id: string; quantity: number; price?: number }[];
  };
  if (!supplier_id || !Array.isArray(items)) {
    return res.status(400).json({ error: 'supplier_id and items required' });
  }
  const order = await service.createDraftOrder(orgId, supplier_id, notes ?? null, userId, items);
  res.status(201).json(order);
});

router.post('/orders/bulk-text', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const userId = req.user!.userId ?? null;
  const { text, default_supplier_id } = req.body as { text: string; default_supplier_id?: string };
  if (!text) return res.status(400).json({ error: 'text required' });
  const result = await service.createOrdersFromBulkText(orgId, userId, text, default_supplier_id ?? null);
  res.json(result);
});

router.post('/orders/:id/send', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const channels = (req.body.channels as SendOrderJobPayload['channels']) || [
    'email',
    'telegram',
    'whatsapp',
    'api_endpoint',
  ];
  await service.queueSendOrder({
    orderId: req.params.id,
    organizationId: orgId,
    channels,
  });
  res.status(202).json({ message: 'Send queued' });
});

router.get('/filters', async (req: AuthRequest, res: Response) => {
  const filters = await repo.listFilters(req.user!.organizationId!);
  res.json({ filters });
});

router.post('/filters', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const { supplier_id, keyword, priority } = req.body as {
    supplier_id: string;
    keyword: string;
    priority?: number;
  };
  if (!supplier_id || !keyword) return res.status(400).json({ error: 'supplier_id, keyword required' });
  await repo.upsertFilter(orgId, supplier_id, keyword, priority ?? 0);
  res.status(201).json({ ok: true });
});

router.delete('/filters/:id', async (req: AuthRequest, res: Response) => {
  const ok = await repo.deleteFilter(req.params.id, req.user!.organizationId!);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/suppliers/:supplierId/contacts', async (req: AuthRequest, res: Response) => {
  const contacts = await repo.listContacts(req.params.supplierId);
  res.json({ contacts });
});

router.post('/suppliers/:supplierId/contacts', async (req: AuthRequest, res: Response) => {
  const { type, value } = req.body as { type: string; value: string };
  if (!type || !value) return res.status(400).json({ error: 'type, value required' });
  await repo.addContact(req.params.supplierId, type, value);
  res.status(201).json({ ok: true });
});

router.get('/automation-rules', async (req: AuthRequest, res: Response) => {
  const rules = await repo.listRules(req.user!.organizationId!);
  res.json({ rules });
});

router.post('/automation-rules', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId!;
  const { rule_type, conditions, actions } = req.body as {
    rule_type: string;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
  };
  if (!rule_type) return res.status(400).json({ error: 'rule_type required' });
  const id = await repo.createRule(orgId, rule_type, conditions || {}, actions || {});
  res.status(201).json({ id });
});

export default router;
