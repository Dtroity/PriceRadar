import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import { sendSupplierOrderEmail } from '../services/emailNotifier.js';
import { sendTelegramRaw } from '../services/telegramNotifier.js';
import { sendWebPushNotificationToUser } from '../services/webPushNotifier.js';
import { logger } from '../utils/logger.js';

export async function listOrderDispatches(req: AuthRequest, res: Response) {
  const orgId = req.user?.organizationId;
  if (!orgId) return res.status(400).json({ error: 'Organization required' });
  const orderId = req.params.id;

  const { rows } = await pool.query<{
    id: string;
    status: string;
    sent_at: string;
    responded_at: string | null;
    supplier_id: string;
    supplier_name: string;
    supplier_email: string | null;
    items_count: string;
    unread_messages_count: string;
  }>(
    `
    SELECT
      d.id,
      d.status,
      d.sent_at::timestamptz::text AS sent_at,
      d.responded_at::timestamptz::text AS responded_at,
      s.id AS supplier_id,
      s.name AS supplier_name,
      s.email AS supplier_email,
      (
        SELECT COUNT(*)::text
        FROM procurement_items pi
        WHERE pi.order_id = d.order_id AND pi.supplier_id = d.supplier_id
      ) AS items_count,
      (
        SELECT COUNT(*)::text
        FROM order_messages m
        WHERE m.dispatch_id = d.id
          AND m.sender_type = 'supplier'
          AND m.read_at IS NULL
      ) AS unread_messages_count
    FROM order_dispatches d
    JOIN suppliers s ON s.id = d.supplier_id
    WHERE d.order_id = $1::uuid AND d.organization_id = $2::uuid
    ORDER BY d.sent_at ASC
    `,
    [orderId, orgId]
  );

  return res.json({
    dispatches: rows.map((r) => ({
      id: r.id,
      status: r.status,
      sent_at: r.sent_at,
      responded_at: r.responded_at,
      items_count: parseInt(r.items_count ?? '0', 10),
      unread_messages_count: parseInt(r.unread_messages_count ?? '0', 10),
      supplier: { id: r.supplier_id, name: r.supplier_name, email: r.supplier_email },
    })),
  });
}

export async function getDispatchMessages(req: AuthRequest, res: Response) {
  const orgId = req.user?.organizationId;
  if (!orgId) return res.status(400).json({ error: 'Organization required' });
  const dispatchId = req.params.dispatchId;

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
    [dispatchId]
  );

  // mark supplier messages as read
  await pool.query(
    `
    UPDATE order_messages
    SET read_at = NOW()
    WHERE dispatch_id = $1::uuid
      AND sender_type = 'supplier'
      AND read_at IS NULL
    `,
    [dispatchId]
  );

  return res.json({ messages });
}

export async function postDispatchMessage(req: AuthRequest, res: Response) {
  const orgId = req.user?.organizationId;
  const userId = req.user?.userId;
  if (!orgId || !userId) return res.status(400).json({ error: 'Organization required' });
  const dispatchId = req.params.dispatchId;
  const message = String((req.body as { message?: string } | undefined)?.message ?? '').trim();
  if (!message) return res.status(400).json({ error: 'message required' });

  await pool.query(
    `
    INSERT INTO order_messages (dispatch_id, sender_type, sender_id, sender_name, message)
    VALUES ($1::uuid, 'manager', $2::uuid, NULL, $3)
    `,
    [dispatchId, userId, message]
  );

  // Web Push supplier (if supplier has linked account_user_id and has subscriptions)
  const { rows } = await pool.query<{
    supplier_user_id: string | null;
    supplier_name: string;
    org_name: string;
    access_token: string;
  }>(
    `
    SELECT
      s.account_user_id AS supplier_user_id,
      s.name AS supplier_name,
      o.name AS org_name,
      d.access_token
    FROM order_dispatches d
    JOIN suppliers s ON s.id = d.supplier_id
    JOIN organizations o ON o.id = d.organization_id
    WHERE d.id = $1::uuid AND d.organization_id = $2::uuid
    `,
    [dispatchId, orgId]
  );
  const row = rows[0];
  if (row?.supplier_user_id) {
    await sendWebPushNotificationToUser({
      organizationId: orgId,
      userId: row.supplier_user_id,
      title: 'Новое сообщение',
      body: `${row.org_name}: сообщение от менеджера`,
      url: `/order/${row.access_token}`,
    }).catch(() => {});
  }

  return res.json({ ok: true });
}

export async function resendDispatch(req: AuthRequest, res: Response) {
  const orgId = req.user?.organizationId;
  if (!orgId) return res.status(400).json({ error: 'Organization required' });
  const dispatchId = req.params.dispatchId;

  const { rows } = await pool.query<{
    id: string;
    order_id: string;
    supplier_id: string;
    access_token: string;
    token_expires_at: string;
    supplier_name: string;
    supplier_email: string | null;
    supplier_contact_name: string | null;
    supplier_notify_channel: string;
    supplier_telegram_chat_id: string | null;
    org_name: string;
  }>(
    `
    UPDATE order_dispatches d
    SET access_token = gen_random_uuid()::text,
        token_expires_at = NOW() + INTERVAL '7 days',
        sent_at = NOW()
    FROM suppliers s
    JOIN organizations o ON o.id = d.organization_id
    WHERE d.id = $1::uuid
      AND d.organization_id = $2::uuid
      AND s.id = d.supplier_id
    RETURNING
      d.id, d.order_id, d.supplier_id, d.access_token,
      d.token_expires_at::timestamptz::text AS token_expires_at,
      s.name AS supplier_name,
      s.email AS supplier_email,
      s.contact_name AS supplier_contact_name,
      s.notify_channel AS supplier_notify_channel,
      s.telegram_chat_id AS supplier_telegram_chat_id,
      o.name AS org_name
    `,
    [dispatchId, orgId]
  );
  const d = rows[0];
  if (!d) return res.status(404).json({ error: 'Not found' });

  const linkBase = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const orderLink = `${linkBase}/order/${d.access_token}`;

  const { rows: items } = await pool.query<{ product_name: string; quantity: string; unit: string | null }>(
    `
    SELECT p.name AS product_name, pi.quantity::text AS quantity, pi.unit
    FROM procurement_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.order_id = $1::uuid AND pi.supplier_id = $2::uuid
    ORDER BY p.name ASC
    `,
    [d.order_id, d.supplier_id]
  );

  if (d.supplier_email && (d.supplier_notify_channel === 'email' || d.supplier_notify_channel === 'both')) {
    await sendSupplierOrderEmail({
      to: d.supplier_email,
      contactName: d.supplier_contact_name ?? d.supplier_name,
      restaurantName: d.org_name,
      items,
      orderLink,
      expiresAt: d.token_expires_at,
      subject: `Повторная отправка заказа от ${d.org_name}`,
    });
  }

  if (
    d.supplier_telegram_chat_id &&
    (d.supplier_notify_channel === 'telegram' || d.supplier_notify_channel === 'both')
  ) {
    const lines = items.map((i) => `- ${i.product_name}: ${i.quantity}${i.unit ? ` ${i.unit}` : ''}`).join('\n');
    await sendTelegramRaw(
      String(d.supplier_telegram_chat_id),
      `Повторная отправка заказа от ${d.org_name}\n\n${lines}\n\nОткрыть: ${orderLink}`
    );
  }

  logger.info({ dispatchId: d.id }, 'dispatch resend');
  return res.json({ ok: true });
}

