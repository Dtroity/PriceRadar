import { pool } from '../db/pool.js';
import bcrypt from 'bcryptjs';
export async function findUserByEmail(email) {
    const { rows } = await pool.query('SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1', [email]);
    return rows[0] ?? null;
}
export async function findUserById(id) {
    const { rows } = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
}
export async function createUser(email, password, role = 'viewer') {
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`, [email, password_hash, role]);
    return rows[0];
}
export async function saveRefreshToken(userId, tokenHash, expiresAt) {
    await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, tokenHash, expiresAt]);
}
export async function findRefreshToken(userId, tokenHash) {
    const { rows } = await pool.query('SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()', [userId, tokenHash]);
    return rows.length > 0;
}
export async function deleteRefreshToken(userId, tokenHash) {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2', [
        userId,
        tokenHash,
    ]);
}
export async function deleteExpiredRefreshTokens() {
    await pool.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}
