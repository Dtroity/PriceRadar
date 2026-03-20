import { pool } from '../db/pool.js';
export async function getTelegramUserByTelegramId(telegramId) {
    const { rows } = await pool.query('SELECT id, telegram_id, username, role, is_allowed, created_at, organization_id FROM telegram_users WHERE telegram_id = $1 LIMIT 1', [telegramId]);
    const r = rows[0];
    return r ? { ...r, organization_id: r.organization_id ?? '' } : null;
}
export async function getAllTelegramUsers() {
    const { rows } = await pool.query('SELECT id, telegram_id, username, role, is_allowed, created_at FROM telegram_users ORDER BY created_at DESC');
    return rows;
}
export async function getTelegramUsersByOrganization(organizationId) {
    const { rows } = await pool.query('SELECT id, telegram_id, username, role, is_allowed, created_at FROM telegram_users WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId]);
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
export async function setTelegramUserAllowedForOrganization(organizationId, telegramId, isAllowed) {
    await pool.query('UPDATE telegram_users SET is_allowed = $1 WHERE organization_id = $2 AND telegram_id = $3', [isAllowed, organizationId, telegramId]);
}
export async function setTelegramUserRole(id, role) {
    await pool.query('UPDATE telegram_users SET role = $1 WHERE id = $2', [role, id]);
}
export async function removeTelegramUser(id) {
    await pool.query('DELETE FROM telegram_users WHERE id = $1', [id]);
}
export async function removeTelegramUserForOrganization(organizationId, id) {
    await pool.query('DELETE FROM telegram_users WHERE organization_id = $1 AND id = $2', [organizationId, id]);
}
export async function getAllowedTelegramIds() {
    const { rows } = await pool.query('SELECT telegram_id FROM telegram_users WHERE is_allowed = TRUE');
    return rows.map((r) => r.telegram_id);
}
export async function getAllowedTelegramIdsForOrg(organizationId) {
    try {
        const { rows } = await pool.query('SELECT telegram_id FROM telegram_users WHERE organization_id = $1 AND is_allowed = TRUE', [organizationId]);
        return rows.map((r) => r.telegram_id);
    }
    catch {
        return [];
    }
}
