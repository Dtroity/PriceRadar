import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as ordersModel from '../models/procurementOrdersModel.js';
import * as recModel from '../models/procurementRecommendationsModel.js';
import { canTransition, type ProcurementOrderStatus } from '../procurement/orderStatus.js';
import { generateRecommendations } from '../services/recommendationEngine.js';
import { notify } from '../services/telegramNotifier.js';
import { dispatchOrder } from '../services/orderDispatcher.js';
import { logger } from '../utils/logger.js';

function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization required' });
    return null;
  }
  return orgId;
}

const STATUSES: ProcurementOrderStatus[] = [
  'draft',
  'pending',
  'approved',
  'ordered',
  'received',
  'cancelled',
];

export async function listOrders(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const status = req.query.status as string | undefined;
  const supplier_id = req.query.supplier_id as string | undefined;
  const date_from = req.query.date_from ? new Date(String(req.query.date_from)) : undefined;
  const date_to = req.query.date_to ? new Date(String(req.query.date_to)) : undefined;
  const createdBy = req.user?.role === 'employee' ? (req.user?.userId ?? null) : null;
  const rows = await ordersModel.listOrders(orgId, {
    status,
    supplierId: supplier_id,
    dateFrom: date_from,
    dateTo: date_to,
    createdBy: createdBy ?? undefined,
  });
  return res.json({ orders: rows });
}

export async function createOrder(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = req.body as {
    title?: string;
    supplier_id?: string;
    notes?: string;
    items?: Array<{
      product_id: string;
      quantity: number;
      unit?: string;
      target_price?: number;
      supplier_id?: string;
    }>;
  };
  const order = await ordersModel.createOrder({
    organizationId: orgId,
    createdBy: req.user?.userId ?? null,
    title: body.title ?? null,
    supplierId: body.supplier_id ?? null,
    notes: body.notes ?? null,
  });
  if (Array.isArray(body.items)) {
    for (const it of body.items) {
      if (!it.product_id || it.quantity == null) continue;
      await ordersModel.addItem({
        orderId: order.id,
        productId: it.product_id,
        quantity: Number(it.quantity),
        unit: it.unit ?? null,
        targetPrice: it.target_price ?? null,
        supplierId: it.supplier_id ?? null,
      });
    }
  }
  return res.status(201).json(order);
}

export async function getOrder(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const order = await ordersModel.getOrder(req.params.id, orgId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (req.user?.role === 'employee' && order.created_by !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const items = await ordersModel.getOrderItems(order.id);
  const total = await ordersModel.orderTotalSum(order.id);
  return res.json({ ...order, items, total_sum: total });
}

export async function patchOrder(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = req.body as {
    title?: string | null;
    supplier_id?: string | null;
    notes?: string | null;
    status?: ProcurementOrderStatus;
  };
  if (body.status !== undefined) {
    return res.status(400).json({ error: 'Use PATCH /orders/:id/status to change status' });
  }
  const row = await ordersModel.patchOrderHeader(req.params.id, orgId, {
    title: body.title,
    supplier_id: body.supplier_id,
    notes: body.notes,
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
}

export async function patchOrderStatus(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const { status } = req.body as { status?: ProcurementOrderStatus };
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const cur = await ordersModel.getOrder(req.params.id, orgId);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  if (!canTransition(cur.status, status)) {
    return res.status(400).json({ error: `Cannot transition ${cur.status} → ${status}` });
  }
  const oldStatus = cur.status;
  const row = await ordersModel.setOrderStatus(req.params.id, orgId, status);
  notify(orgId, {
    type: 'order_status',
    order: { title: row!.title, status: row!.status },
    oldStatus,
    newStatus: status,
  }).catch(() => {});

  if (status === 'approved') {
    dispatchOrder(req.params.id, orgId).catch((err) =>
      logger.error({ err, orderId: req.params.id }, 'Dispatch failed')
    );
  }
  return res.json(row);
}

export async function addItem(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const order = await ordersModel.getOrder(req.params.id, orgId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const body = req.body as {
    product_id?: string;
    quantity?: number;
    unit?: string;
    target_price?: number;
    supplier_id?: string;
  };
  if (!body.product_id || body.quantity == null) {
    return res.status(400).json({ error: 'product_id and quantity required' });
  }
  const item = await ordersModel.addItem({
    orderId: order.id,
    productId: body.product_id,
    quantity: Number(body.quantity),
    unit: body.unit ?? null,
    targetPrice: body.target_price ?? null,
    supplierId: body.supplier_id ?? null,
  });
  return res.status(201).json(item);
}

export async function patchItem(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const order = await ordersModel.getOrder(req.params.id, orgId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const body = req.body as { quantity?: number; actual_price?: number | null; note?: string | null };
  const row = await ordersModel.patchItem(order.id, req.params.itemId, body);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  return res.json(row);
}

export async function deleteItem(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const order = await ordersModel.getOrder(req.params.id, orgId);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const ok = await ordersModel.deleteItem(order.id, req.params.itemId);
  if (!ok) return res.status(404).json({ error: 'Item not found' });
  return res.json({ ok: true });
}

export async function priceHint(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const productId = req.query.product_id as string;
  if (!productId) return res.status(400).json({ error: 'product_id required' });
  const hint = await ordersModel.getPriceHint(orgId, productId);
  return res.json(hint);
}

export async function listRecommendations(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const reason = req.query.reason as recModel.RecReason | undefined;
  const priority_max = req.query.priority_max ? parseInt(String(req.query.priority_max), 10) : undefined;
  const rows = await recModel.listActive(orgId, {
    reason: reason && ['low_stock', 'price_drop', 'regular_cycle'].includes(reason) ? reason : undefined,
    priorityMax: Number.isFinite(priority_max!) ? priority_max : undefined,
  });
  return res.json({ recommendations: rows });
}

export async function acceptRecommendation(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const rec = await recModel.getById(req.params.id, orgId);
  if (!rec || rec.status !== 'active') return res.status(404).json({ error: 'Not found' });
  const qty = rec.suggested_qty != null ? parseFloat(rec.suggested_qty) : 1;
  const order = await ordersModel.createOrder({
    organizationId: orgId,
    createdBy: req.user?.userId ?? null,
    title: `По рекомендации: ${rec.product_name ?? rec.product_id}`,
    supplierId: rec.supplier_id,
    notes: null,
  });
  await ordersModel.addItem({
    orderId: order.id,
    productId: rec.product_id,
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: null,
    targetPrice: rec.suggested_price != null ? parseFloat(rec.suggested_price) : null,
    supplierId: rec.supplier_id,
  });
  await recModel.acceptRecommendation(rec.id, orgId, order.id);
  return res.json({ ok: true, order_id: order.id });
}

export async function dismissRecommendation(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const ok = await recModel.dismissRecommendation(req.params.id, orgId);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true });
}

export async function runGenerateRecommendations(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  try {
    const n = await generateRecommendations(orgId);
    return res.json({ created: n });
  } catch (e) {
    logger.error({ e }, 'generateRecommendations http failed');
    return res.status(500).json({ error: 'Failed' });
  }
}
