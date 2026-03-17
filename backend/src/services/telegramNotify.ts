import { getAllowedTelegramIds, getAllowedTelegramIdsForOrg } from '../models/telegramUsers.js';
import { config } from '../config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let botInstance: any = null;

export function getTelegramBot() {
  if (!config.telegram.botToken || !config.telegram.enabled) return null;
  if (!botInstance) {
    const TelegramBot = require('node-telegram-bot-api');
    botInstance = new TelegramBot(config.telegram.botToken, { polling: false });
  }
  return botInstance;
}

export async function notifyPriceChange(
  supplierName: string,
  productName: string,
  oldPrice: number,
  newPrice: number,
  changePercent: number,
  isPriority: boolean
): Promise<void> {
  const bot = getTelegramBot();
  if (!bot) return;

  const header = isPriority ? '⚠️ PRIORITY PRICE CHANGE\n\n' : 'Price change detected\n\n';
  const text =
    header +
    `Supplier: ${supplierName}\n` +
    `Product: ${productName}\n\n` +
    `Old price: ${oldPrice}\n` +
    `New price: ${newPrice}\n\n` +
    `Change: ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`;

  const chatIds = await getAllowedTelegramIds();
  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, text);
    } catch (err) {
      console.error('Telegram send error:', err);
    }
  }
}

export async function notifyLowStock(
  organizationId: string,
  productName: string,
  daysRemaining: number,
  recommendedQty: number,
  supplierName: string,
  expectedSavingsPct?: number
): Promise<void> {
  const bot = getTelegramBot();
  if (!bot) return;
  const chatIds = await getAllowedTelegramIdsForOrg(organizationId);
  if (chatIds.length === 0) return;
  const text =
    `Low stock detected\n\n` +
    `Product: ${productName}\n` +
    `Stock remaining: ${daysRemaining.toFixed(1)} days\n\n` +
    `Recommended order:\n${recommendedQty} kg from ${supplierName}\n` +
    (expectedSavingsPct != null ? `Expected savings: ${expectedSavingsPct}%\n` : '');
  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, text);
    } catch (err) {
      console.error('Telegram send error:', err);
    }
  }
}

export async function notifyAutopilotOrder(organizationId: string, orderId: string, itemCount: number): Promise<void> {
  const bot = getTelegramBot();
  if (!bot) return;
  const chatIds = await getAllowedTelegramIdsForOrg(organizationId);
  if (chatIds.length === 0) return;
  const text = `Autopilot generated order\n\nOrder ID: ${orderId.slice(0, 8)}…\nItems: ${itemCount}`;
  for (const chatId of chatIds) {
    try {
      await bot.sendMessage(chatId, text);
    } catch (err) {
      console.error('Telegram send error:', err);
    }
  }
}
