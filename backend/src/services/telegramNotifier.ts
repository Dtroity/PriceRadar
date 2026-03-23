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

export async function sendTelegramRaw(chatId: string, text: string): Promise<void> {
  const bot = getBot();
  if (!bot || !text) return;
  await bot.sendMessage(chatId, text);
}

export async function notify(organizationId: string, event: NotifyEvent): Promise<void> {
  const { dispatchNotifications } = await import('./notificationService.js');
  await dispatchNotifications(organizationId, event);
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
  await bot.sendMessage(telegram_chat_id, '✅ Vizor360: тестовое сообщение');
}
