import type { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';

type DispatchRow = {
  id: string;
  order_id: string;
  supplier_id: string;
  organization_id: string;
  status: string;
  access_token: string;
  token_expires_at: string;
  sent_at: string;
  responded_at: string | null;
  supplier_note: string | null;
};

async function getDispatchByToken(token: string): Promise<DispatchRow | null> {
  const { rows } = await pool.query<DispatchRow>(
    `SELECT id, order_id, supplier_id, organization_id, status, access_token,
            token_expires_at::timestamptz::text, sent_at::timestamptz::text,
            responded_at::timestamptz::text, supplier_note
     FROM order_dispatches
     WHERE access_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

export async function getOrder(req: Request, res: Response) {
  const token = String(req.params.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });
  const dispatch = await getDispatchByToken(token);
  if (!dispatch) return res.status(404).json({ error: 'Not found' });

  const exp = new Date(dispatch.token_expires_at);
  if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
    return res.status(410).json({ error: 'Token expired' });
  }

  const { rows: orgRows } = await pool.query<{ name: string }>(
    `SELECT name FROM organizations WHERE id = $1::uuid`,
    [dispatch.organization_id]
  );
  const restaurantName = orgRows[0]?.name ?? 'Ресторан';

  const { rows: items } = await pool.query<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: string;
    unit: string | null;
  }>(
    `
    SELECT pi.id, pi.product_id, p.name AS product_name, pi.quantity::text, pi.unit
    FROM procurement_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.order_id = $1::uuid AND pi.supplier_id = $2::uuid
    ORDER BY p.name ASC
    `,
    [dispatch.order_id, dispatch.supplier_id]
  );

  const { rows: messages } = await pool.query<{
    id: string;
    sender_type: string;
    sender_name: string | null;
    message: string;
    created_at: string;
  }>(
    `
    SELECT id, sender_type, sender_name, message, created_at::timestamptz::text AS created_at
    FROM order_messages
    WHERE dispatch_id = $1::uuid
    ORDER BY created_at ASC
    `,
    [dispatch.id]
  );

  return res.json({
    dispatch: {
      id: dispatch.id,
      status: dispatch.status,
      sentAt: dispatch.sent_at,
      respondedAt: dispatch.responded_at,
      expiresAt: dispatch.token_expires_at,
      supplierNote: dispatch.supplier_note,
    },
    restaurantName,
    items,
    messages,
  });
}

export async function acceptOrder(req: Request, res: Response) {
  const token = String(req.params.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });
  const dispatch = await getDispatchByToken(token);
  if (!dispatch) return res.status(404).json({ error: 'Not found' });

  const exp = new Date(dispatch.token_expires_at);
  if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
    return res.status(410).json({ error: 'Token expired' });
  }

  await pool.query(
    `UPDATE order_dispatches
     SET status = 'accepted', responded_at = NOW()
     WHERE id = $1::uuid`,
    [dispatch.id]
  );

  logger.info({ dispatchId: dispatch.id, orderId: dispatch.order_id }, 'public: dispatch accepted');
  return res.json({ ok: true });
}

export async function rejectOrder(req: Request, res: Response) {
  const token = String(req.params.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });
  const note = (req.body as { note?: string } | undefined)?.note ?? null;
  const dispatch = await getDispatchByToken(token);
  if (!dispatch) return res.status(404).json({ error: 'Not found' });

  const exp = new Date(dispatch.token_expires_at);
  if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
    return res.status(410).json({ error: 'Token expired' });
  }

  await pool.query(
    `UPDATE order_dispatches
     SET status = 'rejected', responded_at = NOW(), supplier_note = $2
     WHERE id = $1::uuid`,
    [dispatch.id, note]
  );

  logger.info({ dispatchId: dispatch.id, orderId: dispatch.order_id }, 'public: dispatch rejected');
  return res.json({ ok: true });
}

export async function getMessages(req: Request, res: Response) {
  const token = String(req.params.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });
  const dispatch = await getDispatchByToken(token);
  if (!dispatch) return res.status(404).json({ error: 'Not found' });

  const { rows: messages } = await pool.query<{
    id: string;
    sender_type: string;
    sender_name: string | null;
    message: string;
    created_at: string;
  }>(
    `
    SELECT id, sender_type, sender_name, message, created_at::timestamptz::text AS created_at
    FROM order_messages
    WHERE dispatch_id = $1::uuid
    ORDER BY created_at ASC
    `,
    [dispatch.id]
  );
  return res.json({ messages });
}

export async function sendMessage(req: Request, res: Response) {
  const token = String(req.params.token ?? '').trim();
  if (!token) return res.status(400).json({ error: 'token required' });
  const body = req.body as { message?: string; sender_name?: string } | undefined;
  const message = String(body?.message ?? '').trim();
  if (!message) return res.status(400).json({ error: 'message required' });
  const senderName = body?.sender_name ? String(body.sender_name).trim().slice(0, 100) : null;

  const dispatch = await getDispatchByToken(token);
  if (!dispatch) return res.status(404).json({ error: 'Not found' });

  await pool.query(
    `
    INSERT INTO order_messages (dispatch_id, sender_type, sender_id, sender_name, message)
    VALUES ($1::uuid, 'supplier', NULL, $2, $3)
    `,
    [dispatch.id, senderName, message]
  );

  logger.info({ dispatchId: dispatch.id }, 'public: message from supplier');
  return res.json({ ok: true });
}

