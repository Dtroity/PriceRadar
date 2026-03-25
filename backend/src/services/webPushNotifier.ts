import webpush from 'web-push';
import type { NotifyEvent } from './telegramNotifier.js';
import * as webpushModel from '../models/webpushSubscriptionsModel.js';
import { logger } from '../utils/logger.js';

function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@localhost';
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(mail, pub, priv);
  } catch {
    return false;
  }
  return true;
}

function buildPayload(event: NotifyEvent): { title: string; body: string; url: string } {
  if (event.type === 'anomaly') {
    const a = event.anomaly;
    return {
      title: a.severity === 'high' ? 'Аномалия цены' : 'Изменение цены',
      body: `${a.product_name}: ${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%`,
      url: '/analytics/anomalies',
    };
  }
  if (event.type === 'recommendation_batch') {
    return {
      title: 'Рекомендации закупок',
      body: `Новых: ${event.lines.length}`,
      url: '/procurement/recommendations',
    };
  }
  if (event.type === 'order_status') {
    return {
      title: 'Заявка',
      body: `${event.order.title ?? ''}: ${event.newStatus}`,
      url: '/procurement/orders',
    };
  }
  return { title: 'Vizor360', body: 'Уведомление', url: '/' };
}

export async function sendWebPushNotification(organizationId: string, event: NotifyEvent): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await webpushModel.getAllSubsForSend(organizationId);
  if (subs.length === 0) return;
  const payload = JSON.stringify(buildPayload(event));
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410) {
          await webpushModel.removeByEndpointGlobal(sub.endpoint).catch(() => {});
        } else {
          logger.warn({ err, endpoint: sub.endpoint }, 'webpush send failed');
        }
      }
    })
  );
}

export async function sendWebPushNotificationToUser(params: {
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await webpushModel.getSubsForUser({
    organizationId: params.organizationId,
    userId: params.userId,
  });
  if (subs.length === 0) return;
  const payload = JSON.stringify({ title: params.title, body: params.body, url: params.url });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410) {
          await webpushModel.removeByEndpointGlobal(sub.endpoint).catch(() => {});
        } else {
          logger.warn({ err, endpoint: sub.endpoint }, 'webpush send failed');
        }
      }
    })
  );
}
