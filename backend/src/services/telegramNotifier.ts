import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import * as orgSettings from '../models/organizationsSettingsModel.js';
import type * as recModel from '../models/procurementRecommendationsModel.js';
import { logger } from '../utils/logger.js';

type TelegramBotInstance = InstanceType<typeof TelegramBot>;
let botSingleton: TelegramBotInstance | null = null;

function getBot(): TelegramBotInstance | null {
  if (!config.telegram.botToken) return null;
  if (!botSingleton) {
    botSingleton = new TelegramBot(config.telegram.botToken, { polling: false });
  }
  return botSingleton;
}

export type PriceAnomalyBrief = {
  product_name: string;
  supplier_name: string;
  price_before: number;
  price_after: number;
  change_pct: number;
  severity: 'low' | 'medium' | 'high';
};

type ProcurementOrderBrief = {
  title: string | null;
  status: string;
};

export type NotifyEvent =
  | { type: 'anomaly'; anomaly: PriceAnomalyBrief }
  | { type: 'recommendation'; rec: recModel.RecommendationRow }
  | { type: 'recommendation_batch'; lines: string[] }
  | { type: 'order_status'; order: ProcurementOrderBrief; oldStatus: string; newStatus: string };

function reasonRu(r: string): string {
  if (r === 'low_stock') return 'низкий остаток';
  if (r === 'price_drop') return 'снижение цены';
  if (r === 'regular_cycle') return 'регулярная закупка';
  return r;
}

export async function notify(organizationId: string, event: NotifyEvent): Promise<void> {
  const bot = getBot();
  if (!bot) return;

  const { telegram_chat_id, telegram_notify } = await orgSettings.getTelegramSettings(organizationId);
  if (!telegram_chat_id) return;

  const chatId = telegram_chat_id;
  let text = '';

  try {
    if (event.type === 'anomaly') {
      const a = event.anomaly;
      if (a.severity === 'high' && !telegram_notify.anomaly_high) return;
      if (a.severity === 'medium' && !telegram_notify.anomaly_medium) return;
      if (a.severity === 'low') return;
      if (a.severity === 'high') {
        text = `🔴 Аномалия цены!\nТовар: ${a.product_name}\nПоставщик: ${a.supplier_name}\nБыло: ${a.price_before} → Стало: ${a.price_after} (${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%)\nСерьёзность: ВЫСОКАЯ`;
      } else {
        text = `🟡 Изменение цены\nТовар: ${a.product_name} | ${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%`;
      }
    } else if (event.type === 'recommendation') {
      if (!telegram_notify.recommendation) return;
      const r = event.rec;
      const price =
        r.suggested_price != null ? `${parseFloat(r.suggested_price).toFixed(2)}` : '—';
      text = `💡 Рекомендация закупки\nТовар: ${r.product_name ?? r.product_id}\nПричина: ${reasonRu(r.reason)}\nПредложенная цена: ${price}`;
    } else if (event.type === 'recommendation_batch') {
      if (!telegram_notify.recommendation || event.lines.length === 0) return;
      text = `💡 Новые рекомендации (${event.lines.length})\n${event.lines.slice(0, 20).join('\n')}`;
      if (event.lines.length > 20) text += `\n…`;
    } else if (event.type === 'order_status') {
      if (!telegram_notify.order_status) return;
      const o = event.order;
      text = `📦 Заявка ${o.title ?? '#'}\nСтатус: ${event.oldStatus} → ${event.newStatus}`;
    }

    if (text) await bot.sendMessage(chatId, text);
  } catch (err) {
    logger.warn({ err, organizationId, event: event.type }, 'telegram notify failed');
  }
}

export async function notifyRecommendationBatch(
  organizationId: string,
  since: Date
): Promise<void> {
  const { listNewSince } = await import('../models/procurementRecommendationsModel.js');
  const recs = await listNewSince(organizationId, since);
  if (recs.length === 0) return;
  const lines = recs.map(
    (r) =>
      `• ${r.product_name ?? r.product_id} (${reasonRu(r.reason)})`
  );
  await notify(organizationId, { type: 'recommendation_batch', lines });
}

export async function sendTestMessage(organizationId: string): Promise<void> {
  const bot = getBot();
  if (!bot) throw new Error('Telegram bot not configured');
  const { telegram_chat_id } = await orgSettings.getTelegramSettings(organizationId);
  if (!telegram_chat_id) throw new Error('telegram_chat_id not set');
  await bot.sendMessage(telegram_chat_id, '✅ PriceRadar: тестовое сообщение');
}
