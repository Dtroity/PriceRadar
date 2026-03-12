import * as telegramUsersModel from '../models/telegramUsers.js';
import { config } from '../config.js';
export async function getBotStatus(_req, res) {
    return res.json({
        enabled: config.telegram.enabled && Boolean(config.telegram.botToken),
    });
}
export async function listUsers(_req, res) {
    try {
        const users = await telegramUsersModel.getAllTelegramUsers();
        return res.json({ users });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch Telegram users' });
    }
}
export async function allowUser(req, res) {
    try {
        const { telegramId } = req.params;
        const { isAllowed } = req.body;
        await telegramUsersModel.setTelegramUserAllowed(telegramId, Boolean(isAllowed));
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update user' });
    }
}
export async function removeUser(req, res) {
    try {
        const { id } = req.params;
        await telegramUsersModel.removeTelegramUser(id);
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to remove user' });
    }
}
