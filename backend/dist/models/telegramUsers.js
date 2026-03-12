import { pool } from '../db/pool.js';
export async function getTelegramUserByTelegramId(telegramId) {
    const { rows } = await pool.query('SELECT id, telegram_id, username, role, is_allowed, created_at FROM telegram_users WHERE telegram_id = $1', [telegramId]);
    return rows[0] ?? null;
}
export async function getAllTelegramUsers() {
    const { rows } = await pool.query('SELECT id, telegram_id, username, role, is_allowed, created_at FROM telegram_users ORDER BY created_at DESC');
    return rows;
}
export async function createTelegramUser(telegramId, username, isAllowed = false) {
    const { rows } = await pool.query(`INSERT INTO telegram_users (telegram_id, username, is_allowed) VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, telegram_id, username, role, is_allowed, created_at`, [telegramId, username, isAllowed]);
    return rows[0];
}
export async function setTelegramUserAllowed(telegramId, isAllowed) {
    await pool.query('UPDATE telegram_users SET is_allowed = $1 WHERE telegram_id = $2', [isAllowed, telegramId]);
}
export async function setTelegramUserRole(id, role) {
    await pool.query('UPDATE telegram_users SET role = $1 WHERE id = $2', [role, id]);
}
export async function removeTelegramUser(id) {
    await pool.query('DELETE FROM telegram_users WHERE id = $1', [id]);
}
export async function getAllowedTelegramIds() {
    const { rows } = await pool.query('SELECT telegram_id FROM telegram_users WHERE is_allowed = TRUE');
    return rows.map((r) => r.telegram_id);
}
