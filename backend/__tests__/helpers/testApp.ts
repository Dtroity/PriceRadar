import request from 'supertest';
import bcrypt from 'bcryptjs';
import createApp from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import type { UserRole } from '../../src/types/index.js';

const app = createApp();

/** Supertest-bound HTTP client (paths include /api/...). */
export const api = request(app);

/**
 * Truncate all tenant data. Cascades from organizations to dependent tables.
 */
export async function cleanDb(): Promise<void> {
  await pool.query('TRUNCATE organizations RESTART IDENTITY CASCADE');
}

export async function createTestOrg(role: UserRole = 'org_admin'): Promise<{
  token: string;
  orgId: string;
  userId: string;
  email: string;
}> {
  const slug = `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const {
    rows: [org],
  } = await pool.query<{ id: string }>(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
    ['Test Org', slug]
  );
  const orgId = org!.id;
  const email = `u${Date.now()}@test.local`;
  const password_hash = await bcrypt.hash('password123', 4);
  const {
    rows: [user],
  } = await pool.query<{ id: string }>(
    `INSERT INTO users (organization_id, email, password_hash, role)
     VALUES ($1::uuid, $2, $3, $4) RETURNING id`,
    [orgId, email, password_hash, role]
  );
  const userId = user!.id;
  const token = signAccessToken(userId, email, role, orgId);
  return { token, orgId, userId, email };
}

export async function createTestProduct(orgId: string, name = 'Test Product'): Promise<string> {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  const {
    rows: [r],
  } = await pool.query<{ id: string }>(
    `INSERT INTO products (organization_id, name, normalized_name)
     VALUES ($1::uuid, $2, $3) RETURNING id`,
    [orgId, name, normalized]
  );
  return r!.id;
}

export async function createTestSupplier(orgId: string): Promise<string> {
  const {
    rows: [r],
  } = await pool.query<{ id: string }>(
    `INSERT INTO suppliers (organization_id, name) VALUES ($1::uuid, $2) RETURNING id`,
    [orgId, `Test Supplier ${Date.now()}`]
  );
  return r!.id;
}
