import { getAllowedTelegramIds } from '../models/telegramUsers.js';
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
