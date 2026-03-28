import TelegramBot from 'node-telegram-bot-api';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';
import { getTelegramUserByTelegramId, createTelegramUser } from '../models/telegramUsers.js';
import { submitIngestionFromUploadedFile } from '../services/ingestionOrchestrate.js';
import { pool } from '../db/pool.js';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
const ACCESS_DENIED = 'Access denied.\nContact administrator.';
async function telegramSupplierSummary(organizationId) {
    if (!organizationId)
        return 'Supplier recommendations require organization.';
    const { rows } = await pool.query(`SELECT s.name, ss.total_score FROM supplier_score ss
     JOIN suppliers s ON s.id = ss.supplier_id
     WHERE ss.organization_id = $1 ORDER BY ss.total_score DESC NULLS LAST LIMIT 3`, [organizationId]);
    if (rows.length === 0)
        return 'No supplier scores yet.';
    return 'Recommended suppliers:\n' + rows.map((r, i) => `${i + 1}. ${r.name} (score: ${r.total_score ?? '—'})`).join('\n');
}
async function telegramFoodcostSummary(organizationId) {
    if (!organizationId)
        return 'Food cost requires organization.';
    const { rows } = await pool.query(`SELECT mi.name, fch.food_cost_percent FROM food_cost_history fch
     JOIN menu_items mi ON mi.id = fch.menu_item_id
     WHERE mi.organization_id = $1
     ORDER BY fch.calculated_at DESC LIMIT 5`, [organizationId]);
    if (rows.length === 0)
        return 'No food cost data yet.';
    return 'Recent food cost:\n' + rows.map((r) => `${r.name}: ${Number(r.food_cost_percent * 100).toFixed(0)}%`).join('\n');
}
async function telegramPriceAlertsSummary(organizationId) {
    if (!organizationId)
        return 'Price alerts require organization.';
    const { rows } = await pool.query(`SELECT p.name AS product_name, s.name AS supplier_name, pc.change_percent, pc.new_price
     FROM price_changes pc
     JOIN products p ON p.id = pc.product_id
     JOIN suppliers s ON s.id = pc.supplier_id
     WHERE pc.organization_id = $1 ORDER BY pc.created_at DESC LIMIT 5`, [organizationId]);
    if (rows.length === 0)
        return 'No price changes recently.';
    return 'Price alerts:\n' + rows.map((r) => `${r.product_name} (${r.supplier_name}): ${r.change_percent > 0 ? '+' : ''}${Number(r.change_percent).toFixed(1)}% → ${r.new_price}`).join('\n');
}
export function startTelegramBot() {
    if (!config.telegram.botToken || !config.telegram.enabled) {
        logger.info('Telegram bot disabled (no token or TELEGRAM_BOT_ENABLED=false)');
        return null;
    }
    const bot = new TelegramBot(config.telegram.botToken, { polling: true });
    bot.on('polling_error', (err) => {
        logger.error({ err: err?.message, code: err?.code, stack: err?.stack }, 'Telegram polling_error — проверьте токен, сеть (доступ к api.telegram.org) и что нет второго экземпляра бота с polling');
    });
    bot.onText(/\/start/, async (msg) => {
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
        await bot.sendMessage(chatId, '🤖 Провиатор — AI помощник закупок ресторана\n\nКоманды:\n/upload — отправить прайс-лист\n/supplier — рекомендации поставщиков\n/foodcost — сводка фудкоста\n/price-alerts — последние изменения цен');
    });
    bot.onText(/\/upload/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        await bot.sendMessage(chatId, 'Send the price list file (Excel, CSV, or PDF).');
    });
    bot.on('document', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        const fileId = msg.document?.file_id;
        if (!fileId)
            return;
        try {
            await fs.mkdir(config.upload.dir, { recursive: true });
            const file = await bot.getFile(fileId);
            const ext = path.extname(msg.document?.file_name || file.file_path || '') || '.bin';
            const destPath = path.join(config.upload.dir, `tg_${Date.now()}${ext}`);
            const stream = bot.getFileStream(fileId);
            await pipeline(stream, createWriteStream(destPath));
            const orgId = user.organization_id && String(user.organization_id).trim() !== ''
                ? String(user.organization_id)
                : undefined;
            if (!orgId) {
                await bot.sendMessage(chatId, 'Файл не может быть обработан: ваш Telegram ещё не привязан к организации. Администратор должен разрешить доступ в веб-интерфейсе: Настройки → Telegram.');
                return;
            }
            const result = await submitIngestionFromUploadedFile({
                organizationId: orgId,
                userId: null,
                filePath: destPath,
                originalName: msg.document?.file_name || `document${ext}`,
                mimeType: msg.document?.mime_type || 'application/octet-stream',
                sourceType: 'telegram',
                supplierName: 'Telegram Upload',
            });
            await bot.sendMessage(chatId, result.message);
        }
        catch (err) {
            console.error('Telegram document handling:', err);
            await bot.sendMessage(chatId, 'Failed to process file.');
        }
    });
    bot.onText(/\/supplier/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        const text = await telegramSupplierSummary(user.organization_id ?? '');
        await bot.sendMessage(chatId, text);
    });
    bot.onText(/\/foodcost/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        const text = await telegramFoodcostSummary(user.organization_id ?? '');
        await bot.sendMessage(chatId, text);
    });
    bot.onText(/\/price-alerts/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        const text = await telegramPriceAlertsSummary(user.organization_id ?? '');
        await bot.sendMessage(chatId, text);
    });
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from?.id);
        const user = await getTelegramUserByTelegramId(telegramId);
        if (!user?.is_allowed) {
            await bot.sendMessage(chatId, ACCESS_DENIED);
            return;
        }
        const photo = msg.photo?.[msg.photo.length - 1];
        if (!photo?.file_id)
            return;
        try {
            await fs.mkdir(config.upload.dir, { recursive: true });
            const destPath = path.join(config.upload.dir, `tg_photo_${Date.now()}.jpg`);
            const stream = bot.getFileStream(photo.file_id);
            await pipeline(stream, createWriteStream(destPath));
            const orgId = user.organization_id && String(user.organization_id).trim() !== ''
                ? String(user.organization_id)
                : undefined;
            if (!orgId) {
                await bot.sendMessage(chatId, 'Фото не обработано: привяжите Telegram к организации (Настройки → Telegram в веб-интерфейсе).');
                return;
            }
            const result = await submitIngestionFromUploadedFile({
                organizationId: orgId,
                userId: null,
                filePath: destPath,
                originalName: `photo_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
                sourceType: 'telegram',
                supplierName: 'Telegram Upload',
            });
            await bot.sendMessage(chatId, result.message);
        }
        catch (err) {
            console.error('Telegram photo handling:', err);
            await bot.sendMessage(chatId, 'Failed to process photo.');
        }
    });
    logger.info('Telegram bot started (long polling)');
    return bot;
}
