import { pool } from '../db/pool.js';
import type { User, UserRole } from '../types/index.js';
import bcrypt from 'bcryptjs';

export async function findUserByEmailAndOrg(
  organizationId: string,
  email: string
): Promise<(User & { password_hash: string }) | null> {
  const { rows } = await pool.query(
    'SELECT id, organization_id, email, password_hash, role, created_at FROM users WHERE organization_id = $1 AND email = $2',
    [organizationId, email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query(
    'SELECT id, organization_id, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser(
  organizationId: string,
  email: string,
  password: string,
  role: UserRole = 'manager'
): Promise<User> {
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (organization_id, email, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, organization_id, email, role, created_at`,
    [organizationId, email, password_hash, role]
  );
  return rows[0];
}

export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
}

export async function findRefreshToken(userId: string, tokenHash: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
    [userId, tokenHash]
  );
  return rows.length > 0;
}

export async function deleteRefreshToken(userId: string, tokenHash: string): Promise<void> {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2', [
    userId,
    tokenHash,
  ]);
}
