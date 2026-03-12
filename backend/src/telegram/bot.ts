import TelegramBot from 'node-telegram-bot-api';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';
import { getTelegramUserByTelegramId, createTelegramUser } from '../models/telegramUsers.js';
import { uploadQueue } from '../workers/queue.js';
import path from 'path';
import fs from 'fs/promises';

const ACCESS_DENIED = 'Access denied.\nContact administrator.';

export function startTelegramBot() {
  if (!config.telegram.botToken || !config.telegram.enabled) {
    console.log('Telegram bot disabled (no token or disabled in config)');
    return null;
  }
  const bot = new TelegramBot(config.telegram.botToken, { polling: true });

  bot.onText(/\/start/, async (msg: { chat: { id: number }; from?: { id?: number; username?: string } }) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id);
    const username = msg.from?.username ?? null;
    let user = await getTelegramUserByTelegramId(telegramId);
    if (!user) {
      user = await createTelegramUser(telegramId, username, false);
    }
    if (!user.is_allowed) {
      await bot.sendMessage(chatId, ACCESS_DENIED);
      return;
    }
    await bot.sendMessage(
      chatId,
      'PriceRadar Bot.\n\nCommands:\n/upload - send a price list file (Excel, CSV, PDF)'
    );
  });

  bot.onText(/\/upload/, async (msg: { chat: { id: number }; from?: { id?: number } }) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id);
    const user = await getTelegramUserByTelegramId(telegramId);
    if (!user?.is_allowed) {
      await bot.sendMessage(chatId, ACCESS_DENIED);
      return;
    }
    await bot.sendMessage(chatId, 'Send the price list file (Excel, CSV, or PDF).');
  });

  bot.on('document', async (msg: { chat: { id: number }; from?: { id?: number }; document?: { file_id: string; file_name?: string; mime_type?: string } }) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id);
    const user = await getTelegramUserByTelegramId(telegramId);
    if (!user?.is_allowed) {
      await bot.sendMessage(chatId, ACCESS_DENIED);
      return;
    }
    const fileId = msg.document?.file_id;
    if (!fileId) return;
    try {
      await fs.mkdir(config.upload.dir, { recursive: true });
      const file = await bot.getFile(fileId);
      const ext = path.extname(msg.document?.file_name || file.file_path || '') || '.bin';
      const destPath = path.join(config.upload.dir, `tg_${Date.now()}${ext}`);
      const stream = bot.getFileStream(fileId);
      await pipeline(stream as NodeJS.ReadableStream, createWriteStream(destPath));
      await uploadQueue.add(
        'process',
        {
          filePath: destPath,
          supplierName: 'Telegram Upload',
          sourceType: 'telegram',
          mimeType: msg.document?.mime_type || 'application/octet-stream',
          originalName: msg.document?.file_name || `document${ext}`,
        },
        { attempts: 2 }
      );
      await bot.sendMessage(chatId, 'File received. Processing started.');
    } catch (err) {
      console.error('Telegram document handling:', err);
      await bot.sendMessage(chatId, 'Failed to process file.');
    }
  });

  bot.on('photo', async (msg: { photo?: { file_id: string }[]; chat: { id: number }; from?: { id?: number } }) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from?.id);
    const user = await getTelegramUserByTelegramId(telegramId);
    if (!user?.is_allowed) {
      await bot.sendMessage(chatId, ACCESS_DENIED);
      return;
    }
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo?.file_id) return;
    try {
      await fs.mkdir(config.upload.dir, { recursive: true });
      const destPath = path.join(config.upload.dir, `tg_photo_${Date.now()}.jpg`);
      const stream = bot.getFileStream(photo.file_id);
      await pipeline(stream as NodeJS.ReadableStream, createWriteStream(destPath));
      await uploadQueue.add(
        'process',
        {
          filePath: destPath,
          supplierName: 'Telegram Upload',
          sourceType: 'telegram',
          mimeType: 'image/jpeg',
          originalName: `photo_${Date.now()}.jpg`,
        },
        { attempts: 2 }
      );
      await bot.sendMessage(chatId, 'Photo received. OCR processing may be available in a future update.');
    } catch (err) {
      console.error('Telegram photo handling:', err);
      await bot.sendMessage(chatId, 'Failed to process photo.');
    }
  });

  console.log('Telegram bot started');
  return bot;
}
