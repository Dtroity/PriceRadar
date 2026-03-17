import { pool } from '../db/pool.js';
import type { IntegrationCredentials } from '../types/index.js';

export async function getByOrgAndProvider(
  organizationId: string,
  provider: string
): Promise<IntegrationCredentials | null> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, provider, config, is_active, created_at, updated_at
     FROM integration_credentials WHERE organization_id = $1 AND provider = $2`,
    [organizationId, provider]
  );
  return rows[0] ?? null;
}

export async function upsert(
  organizationId: string,
  provider: 'iiko' | 'rkeeper' | 'poster',
  config: Record<string, unknown>,
  isActive = true
): Promise<IntegrationCredentials> {
  const { rows } = await pool.query(
    `INSERT INTO integration_credentials (organization_id, provider, config, is_active)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, provider) DO UPDATE SET config = $3, is_active = $4, updated_at = NOW()
     RETURNING id, organization_id, provider, config, is_active, created_at, updated_at`,
    [organizationId, provider, JSON.stringify(config), isActive]
  );
  return rows[0];
}
