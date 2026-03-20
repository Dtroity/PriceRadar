import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as telegramUsersModel from '../models/telegramUsers.js';
import { config } from '../config.js';

export async function getBotStatus(_req: AuthRequest, res: Response) {
  return res.json({
    enabled: config.telegram.enabled && Boolean(config.telegram.botToken),
  });
}

export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    const users = role === 'super_admin'
      ? await telegramUsersModel.getAllTelegramUsers()
      : organizationId
        ? await telegramUsersModel.getTelegramUsersByOrganization(organizationId)
        : [];
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch Telegram users' });
  }
}

export async function allowUser(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    const { telegramId } = req.params;
    const { isAllowed } = req.body as { isAllowed?: boolean };
    if (role === 'super_admin') {
      await telegramUsersModel.setTelegramUserAllowed(telegramId, Boolean(isAllowed));
    } else {
      if (!organizationId) return res.status(403).json({ error: 'Organization scope required' });
      await telegramUsersModel.setTelegramUserAllowedForOrganization(organizationId, telegramId, Boolean(isAllowed));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function removeUser(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    const { id } = req.params;
    if (role === 'super_admin') {
      await telegramUsersModel.removeTelegramUser(id);
    } else {
      if (!organizationId) return res.status(403).json({ error: 'Organization scope required' });
      await telegramUsersModel.removeTelegramUserForOrganization(organizationId, id);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to remove user' });
  }
}
