import type { NotifyEvent } from './telegramNotifier.js';
import { logger } from '../utils/logger.js';

/** Graceful no-op if VK_NOTIFY_TOKEN is not set. VK API shape may vary — adjust when integrating. */
export async function sendVkNotification(phone: string, event: NotifyEvent): Promise<void> {
  const token = process.env.VK_NOTIFY_TOKEN;
  if (!token) return;
  const message = summarizeForVk(event);
  if (!message) return;
  try {
    const params = new URLSearchParams({
      phone,
      message,
      access_token: token,
      v: '5.199',
      random_id: String(Math.floor(Math.random() * 1e9)),
    });
    const res = await fetch(`https://api.vk.com/method/messages.send?${params.toString()}`, {
      method: 'POST',
    });
    const data = (await res.json()) as { error?: { error_msg: string } };
    if (data.error) {
      logger.warn({ err: data.error }, 'vk notify API error');
    }
  } catch (e) {
    logger.warn({ e }, 'vk notify failed');
  }
}

function summarizeForVk(event: NotifyEvent): string | null {
  if (event.type === 'anomaly') {
    const a = event.anomaly;
    return `Vizor360: ${a.product_name} — цена ${a.price_before}→${a.price_after}`;
  }
  if (event.type === 'recommendation_batch') {
    return `Vizor360: ${event.lines.length} новых рекомендаций`;
  }
  if (event.type === 'order_status') {
    return `Vizor360: заявка ${event.order.title ?? ''} ${event.oldStatus}→${event.newStatus}`;
  }
  if (event.type === 'recommendation') {
    return `Vizor360: рекомендация ${event.rec.product_name ?? event.rec.product_id}`;
  }
  return null;
}
