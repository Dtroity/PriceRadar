import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as orgNotify from '../models/organizationNotifyModel.js';
import * as webpushModel from '../models/webpushSubscriptionsModel.js';
import * as matrixModel from '../models/notificationSettingsModel.js';
import { organizationHasModule } from '../modules/_shared/subscriptionRepository.js';
import { sendTestNotifications } from '../services/notificationService.js';

function requireOrg(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: 'Organization required' });
    return null;
  }
  return orgId;
}

export async function getSettings(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  try {
    const row = await orgNotify.getOrgNotifyRow(orgId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const subs = await webpushModel.listByOrganization(orgId);
    return res.json({
      notify_email: row.notify_email,
      notify_email_enabled: row.notify_email_enabled,
      vk_notify_phone: row.vk_notify_phone,
      vk_notify_enabled: row.vk_notify_enabled,
      webpush_enabled: row.webpush_enabled,
      notify_events: orgNotify.mergeNotifyEvents(row),
      telegram_chat_id: row.telegram_chat_id,
      telegram_notify: row.telegram_notify,
      webpush_subscriptions: subs,
    });
  } catch {
    return res.status(503).json({ error: 'Notification settings unavailable (run migrations?)' });
  }
}

export async function patchSettings(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = req.body as Partial<{
    notify_email: string | null;
    notify_email_enabled: boolean;
    vk_notify_phone: string | null;
    vk_notify_enabled: boolean;
    webpush_enabled: boolean;
    notify_events: orgNotify.NotifyEventsConfig;
  }>;

  if (body.vk_notify_enabled || body.vk_notify_phone != null) {
    const vkOk = await organizationHasModule(orgId, 'notifications_vk').catch(() => false);
    if (!vkOk) {
      return res.status(403).json({
        error: 'Module not available',
        module: 'notifications_vk',
        upgrade_hint: 'Обратитесь к администратору для подключения VK Notify',
      });
    }
  }

  if (body.notify_email_enabled || body.notify_email != null) {
    const emOk = await organizationHasModule(orgId, 'notifications_email').catch(() => false);
    if (!emOk && (body.notify_email_enabled === true || body.notify_email)) {
      return res.status(403).json({
        error: 'Module not available',
        module: 'notifications_email',
        upgrade_hint: 'Обратитесь к администратору для подключения email-уведомлений',
      });
    }
  }

  try {
    await orgNotify.patchOrgNotifySettings(orgId, body);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function postTest(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  try {
    await sendTestNotifications(orgId);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Test send failed' });
  }
}

export async function postWebPushSubscribe(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const pushOk = await organizationHasModule(orgId, 'notifications_push').catch(() => false);
  if (!pushOk) {
    return res.status(403).json({
      error: 'Module not available',
      module: 'notifications_push',
      upgrade_hint: 'Обратитесь к администратору для подключения Web Push',
    });
  }
  const { endpoint, p256dh, auth } = req.body as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'endpoint, p256dh, auth required' });
  }
  await webpushModel.upsertSubscription({
    organizationId: orgId,
    userId: req.user?.userId ?? null,
    endpoint,
    p256dh,
    auth,
    userAgent: req.headers['user-agent'] ?? null,
  });
  return res.status(201).json({ ok: true });
}

export async function deleteWebPushSubscribe(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const { endpoint, id } = req.body as { endpoint?: string; id?: string };
  if (endpoint) {
    const ok = await webpushModel.deleteByEndpoint(orgId, endpoint);
    return res.json({ ok });
  }
  if (id) {
    const ok = await webpushModel.deleteById(orgId, id);
    return res.json({ ok });
  }
  return res.status(400).json({ error: 'endpoint or id required' });
}

export async function getVapidPublicKey(_req: AuthRequest, res: Response) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.json({ publicKey: null });
  return res.json({ publicKey: key });
}

const DEFAULTS: Array<{
  event_type: string;
  channel: string;
  enabled: boolean;
  include_details?: { items: boolean; total: boolean; link: boolean };
}> = [
  { event_type: 'order_dispatched', channel: 'webpush', enabled: true },
  { event_type: 'order_dispatched', channel: 'in_app', enabled: true },
  {
    event_type: 'order_dispatched',
    channel: 'email',
    enabled: true,
    include_details: { items: true, total: false, link: true },
  },
  { event_type: 'order_accepted', channel: 'webpush', enabled: true },
  { event_type: 'order_accepted', channel: 'in_app', enabled: true },
  { event_type: 'order_accepted', channel: 'telegram', enabled: false },
  { event_type: 'order_rejected', channel: 'webpush', enabled: true },
  { event_type: 'order_rejected', channel: 'email', enabled: true },
  { event_type: 'order_rejected', channel: 'telegram', enabled: false },
  { event_type: 'new_message', channel: 'webpush', enabled: true },
  { event_type: 'new_message', channel: 'in_app', enabled: true },
  { event_type: 'new_message', channel: 'telegram', enabled: false },
  { event_type: 'anomaly_high', channel: 'webpush', enabled: true },
  { event_type: 'anomaly_high', channel: 'email', enabled: true },
  { event_type: 'anomaly_high', channel: 'telegram', enabled: false },
  { event_type: 'anomaly_medium', channel: 'webpush', enabled: false },
  {
    event_type: 'weekly_report',
    channel: 'email',
    enabled: false,
    include_details: { items: false, total: true, link: true },
  },
];

export async function getMatrix(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  try {
    const rows = await matrixModel.listByOrganization(orgId);
    if (rows.length === 0) return res.json({ settings: DEFAULTS });
    return res.json({ settings: rows });
  } catch {
    return res.status(503).json({ error: 'Matrix unavailable (run migrations?)' });
  }
}

export async function putMatrix(req: AuthRequest, res: Response) {
  const orgId = requireOrg(req, res);
  if (!orgId) return;
  const body = (req.body as unknown) as Array<{
    event_type: string;
    channel: string;
    enabled: boolean;
    include_details?: unknown;
  }>;
  if (!Array.isArray(body)) return res.status(400).json({ error: 'Array body required' });
  await matrixModel.upsertMany(orgId, body);
  return res.json({ ok: true });
}
