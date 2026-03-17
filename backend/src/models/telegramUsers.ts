import { pool } from '../db/pool.js';
import type { TelegramUser } from '../types/index.js';

export async function getTelegramUserByTelegramId(telegramId: string): Promise<TelegramUser | null> {
  const { rows } = await pool.query(
    'SELECT id, telegram_id, username, role, is_allowed, created_at, organization_id FROM telegram_users WHERE telegram_id = $1 LIMIT 1',
    [telegramId]
  );
  const r = rows[0];
  return r ? { ...r, organization_id: r.organization_id ?? '' } : null;
}

export async function getAllTelegramUsers(): Promise<TelegramUser[]> {
  const { rows } = await pool.query(
    'SELECT id, telegram_id, username, role, is_allowed, created_at FROM telegram_users ORDER BY created_at DESC'
  );
  return rows;
}

export async function createTelegramUser(
  telegramId: string,
  username: string | null,
  isAllowed = false
): Promise<TelegramUser> {
  const { rows } = await pool.query(
    `INSERT INTO telegram_users (telegram_id, username, is_allowed) VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, telegram_id, username, role, is_allowed, created_at`,
    [telegramId, username, isAllowed]
  );
  return rows[0];
}

export async function setTelegramUserAllowed(telegramId: string, isAllowed: boolean): Promise<void> {
  await pool.query(
    'UPDATE telegram_users SET is_allowed = $1 WHERE telegram_id = $2',
    [isAllowed, telegramId]
  );
}

export async function setTelegramUserRole(id: string, role: string): Promise<void> {
  await pool.query('UPDATE telegram_users SET role = $1 WHERE id = $2', [role, id]);
}

export async function removeTelegramUser(id: string): Promise<void> {
  await pool.query('DELETE FROM telegram_users WHERE id = $1', [id]);
}

export async function getAllowedTelegramIds(): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT telegram_id FROM telegram_users WHERE is_allowed = TRUE'
  );
  return rows.map((r: { telegram_id: string }) => r.telegram_id);
}

export async function getAllowedTelegramIdsForOrg(organizationId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query(
      'SELECT telegram_id FROM telegram_users WHERE organization_id = $1 AND is_allowed = TRUE',
      [organizationId]
    );
    return rows.map((r: { telegram_id: string }) => r.telegram_id);
  } catch {
    return [];
  }
}
