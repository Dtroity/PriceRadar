import * as orgNotify from '../models/organizationNotifyModel.js';
import { organizationHasModule } from '../modules/_shared/subscriptionRepository.js';
import { sendEmailNotification } from './emailNotifier.js';
import { sendVkNotification } from './vkNotifier.js';
import { sendWebPushNotification } from './webPushNotifier.js';
import type { NotifyEvent } from './telegramNotifier.js';
import { sendTelegramRaw } from './telegramNotifier.js';
import { logger } from '../utils/logger.js';
function reasonRu(r: string): string {
  if (r === 'low_stock') return 'низкий остаток';
  if (r === 'price_drop') return 'снижение цены';
  if (r === 'regular_cycle') return 'регулярная закупка';
  return r;
}

function buildTelegramStyleText(event: NotifyEvent, cfg: ReturnType<typeof orgNotify.mergeNotifyEvents>): string {
  if (event.type === 'anomaly') {
    const a = event.anomaly;
    if (a.severity === 'low') return '';
    if (a.severity === 'high' && !cfg.anomaly_high) return '';
    if (a.severity === 'medium' && !cfg.anomaly_medium) return '';
    if (a.severity === 'high') {
      return `🔴 Аномалия цены!\nТовар: ${a.product_name}\nПоставщик: ${a.supplier_name}\nБыло: ${a.price_before} → Стало: ${a.price_after} (${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%)\nСерьёзность: ВЫСОКАЯ\n— Vizor360`;
    }
    return `🟡 Изменение цены\nТовар: ${a.product_name} | ${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%\n— Vizor360`;
  }
  if (event.type === 'recommendation') {
    if (!cfg.recommendation) return '';
    const r = event.rec;
    const price = r.suggested_price != null ? `${parseFloat(r.suggested_price).toFixed(2)}` : '—';
    return `💡 Рекомендация закупки\nТовар: ${r.product_name ?? r.product_id}\nПричина: ${reasonRu(r.reason)}\nПредложенная цена: ${price}\n— Vizor360`;
  }
  if (event.type === 'recommendation_batch') {
    if (!cfg.recommendation || event.lines.length === 0) return '';
    let t = `💡 Новые рекомендации (${event.lines.length})\n${event.lines.slice(0, 20).join('\n')}`;
    if (event.lines.length > 20) t += `\n…`;
    return `${t}\n— Vizor360`;
  }
  if (event.type === 'order_status') {
    if (!cfg.order_status) return '';
    const o = event.order;
    return `📦 Заявка ${o.title ?? '#'}\nСтатус: ${event.oldStatus} → ${event.newStatus}\n— Vizor360`;
  }
  return '';
}

/**
 * Multichannel dispatch: Email, VK, Web Push, Telegram (legacy).
 */
export async function dispatchNotifications(organizationId: string, event: NotifyEvent): Promise<void> {
  let org: orgNotify.OrgNotifyRow | null;
  try {
    org = await orgNotify.getOrgNotifyRow(organizationId);
  } catch (e) {
    logger.warn({ e, organizationId }, 'notify: org row load failed');
    return;
  }
  if (!org) return;

  const cfg = orgNotify.mergeNotifyEvents(org);
  const text = buildTelegramStyleText(event, cfg);
  const tasks: Promise<void>[] = [];

  if (org.notify_email_enabled && org.notify_email && text) {
    tasks.push(
      sendEmailNotification(org.notify_email, event).catch((e) =>
        logger.warn({ e }, 'email notify failed')
      )
    );
  }
  if (org.vk_notify_enabled && org.vk_notify_phone && text) {
    tasks.push(
      sendVkNotification(org.vk_notify_phone, event).catch((e) => logger.warn({ e }, 'vk notify failed'))
    );
  }
  if (org.webpush_enabled && text) {
    tasks.push(
      sendWebPushNotification(organizationId, event).catch((e) =>
        logger.warn({ e }, 'webpush notify failed')
      )
    );
  }

  const telegramOk = await organizationHasModule(organizationId, 'telegram_bot').catch(() => false);
  if (telegramOk && org.telegram_chat_id && text) {
    tasks.push(
      sendTelegramRaw(org.telegram_chat_id, text).catch((e) =>
        logger.warn({ e }, 'telegram notify failed')
      )
    );
  }

  await Promise.allSettled(tasks);
}

/** Test ping for all enabled channels */
export async function sendTestNotifications(organizationId: string): Promise<void> {
  await dispatchNotifications(organizationId, {
    type: 'order_status',
    order: { title: 'Тест Vizor360', status: 'pending' },
    oldStatus: 'draft',
    newStatus: 'pending',
  });
}
