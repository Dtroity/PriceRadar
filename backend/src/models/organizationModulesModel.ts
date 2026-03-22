import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { modulesToEnableForPlan } from '../config/modules.js';

export async function seedModulesForOrganization(
  organizationId: string,
  plan: 'free' | 'pro' | 'enterprise',
  client?: PoolClient
): Promise<void> {
  const q = client ?? pool;
  const mods = modulesToEnableForPlan(plan);
  for (const module of mods) {
    await q.query(
      `INSERT INTO organization_modules (organization_id, module, enabled)
       VALUES ($1::uuid, $2, TRUE)
       ON CONFLICT (organization_id, module) DO UPDATE SET enabled = TRUE, enabled_at = NOW()`,
      [organizationId, module]
    );
  }
}

export async function replaceModulesForPlan(
  organizationId: string,
  plan: 'free' | 'pro' | 'enterprise'
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM organization_modules WHERE organization_id = $1::uuid`, [
      organizationId,
    ]);
    const mods = modulesToEnableForPlan(plan);
    for (const module of mods) {
      await client.query(
        `INSERT INTO organization_modules (organization_id, module, enabled)
         VALUES ($1::uuid, $2, TRUE)`,
        [organizationId, module]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listModules(organizationId: string): Promise<
  Array<{ module: string; enabled: boolean; enabled_at: string | null }>
> {
  const { rows } = await pool.query<{
    module: string;
    enabled: boolean;
    enabled_at: string | null;
  }>(
    `SELECT module, enabled, enabled_at::text FROM organization_modules
     WHERE organization_id = $1::uuid ORDER BY module`,
    [organizationId]
  );
  return rows;
}

export async function setModuleEnabled(
  organizationId: string,
  module: string,
  enabled: boolean,
  enabledBy: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO organization_modules (organization_id, module, enabled, enabled_by)
     VALUES ($1::uuid, $2, $3, $4::uuid)
     ON CONFLICT (organization_id, module)
     DO UPDATE SET enabled = $3, enabled_at = NOW(), enabled_by = $4::uuid`,
    [organizationId, module, enabled, enabledBy]
  );
}

export async function isAnyModuleEnabled(
  organizationId: string,
  candidateKeys: string[]
): Promise<boolean> {
  if (candidateKeys.length === 0) return false;
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT TRUE AS ok FROM organization_modules
     WHERE organization_id = $1::uuid AND enabled = TRUE AND module = ANY($2::text[])
     LIMIT 1`,
    [organizationId, candidateKeys]
  );
  return rows.length > 0;
}

export async function countModuleRows(organizationId: string): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM organization_modules WHERE organization_id = $1::uuid`,
    [organizationId]
  );
  return parseInt(rows[0]?.c ?? '0', 10);
}
