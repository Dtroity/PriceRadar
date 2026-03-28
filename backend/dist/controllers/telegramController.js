import * as telegramUsersModel from '../models/telegramUsers.js';
import * as orgSettings from '../models/organizationsSettingsModel.js';
import { sendTestMessage } from '../services/telegramNotifier.js';
import { config } from '../config.js';
export async function getBotStatus(_req, res) {
    return res.json({
        enabled: config.telegram.enabled && Boolean(config.telegram.botToken),
    });
}
export async function listUsers(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        const role = req.user?.role;
        const users = role === 'super_admin'
            ? await telegramUsersModel.getAllTelegramUsers()
            : organizationId
                ? await telegramUsersModel.getTelegramUsersByOrganization(organizationId)
                : [];
        return res.json({ users });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch Telegram users' });
    }
}
export async function allowUser(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        const role = req.user?.role;
        const { telegramId } = req.params;
        const { isAllowed } = req.body;
        if (role === 'super_admin') {
            if (organizationId) {
                await telegramUsersModel.setTelegramUserAllowedWithOrg(telegramId, Boolean(isAllowed), organizationId);
            }
            else {
                await telegramUsersModel.setTelegramUserAllowed(telegramId, Boolean(isAllowed));
            }
        }
        else {
            if (!organizationId)
                return res.status(403).json({ error: 'Organization scope required' });
            await telegramUsersModel.setTelegramUserAllowedForOrganization(organizationId, telegramId, Boolean(isAllowed));
        }
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update user' });
    }
}
export async function getOrgNotifySettings(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return res.status(400).json({ error: 'Organization required' });
        const s = await orgSettings.getTelegramSettings(organizationId);
        return res.json(s);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed' });
    }
}
export async function patchOrgNotifySettings(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return res.status(400).json({ error: 'Organization required' });
        const body = req.body;
        await orgSettings.saveTelegramOrgSettings(organizationId, body);
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed' });
    }
}
export async function postTestMessage(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return res.status(400).json({ error: 'Organization required' });
        if (!config.telegram.botToken)
            return res.status(503).json({ error: 'Bot not configured' });
        await sendTestMessage(organizationId);
        return res.json({ ok: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed';
        return res.status(400).json({ error: msg });
    }
}
export async function removeUser(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        const role = req.user?.role;
        const { id } = req.params;
        if (role === 'super_admin') {
            await telegramUsersModel.removeTelegramUser(id);
        }
        else {
            if (!organizationId)
                return res.status(403).json({ error: 'Organization scope required' });
            await telegramUsersModel.removeTelegramUserForOrganization(organizationId, id);
        }
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to remove user' });
    }
}
