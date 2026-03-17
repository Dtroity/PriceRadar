import { pool } from '../../db/pool.js';

const cache = new Map<string, { modules: Set<string>; at: number }>();
const TTL_MS = 60_000;

export async function organizationHasModule(organizationId: string, moduleKey: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(organizationId);
  if (cached && now - cached.at < TTL_MS) {
    return cached.modules.has(moduleKey);
  }
  const { rows } = await pool.query(
    `SELECT pm.module_key
     FROM organization_subscriptions os
     JOIN plan_modules pm ON pm.plan_id = os.plan_id AND pm.enabled = TRUE
     WHERE os.organization_id = $1 AND os.status IN ('active', 'trial')`,
    [organizationId]
  );
  if (rows.length === 0) {
    const enabled = new Set(await allModuleKeys());
    cache.set(organizationId, { modules: enabled, at: now });
    return enabled.has(moduleKey);
  }
  const modules = new Set(rows.map((r: { module_key: string }) => r.module_key));
  cache.set(organizationId, { modules, at: now });
  return modules.has(moduleKey);
}

async function allModuleKeys(): Promise<string[]> {
  const { rows } = await pool.query(`SELECT key FROM modules`);
  return rows.map((r: { key: string }) => r.key);
}

export function invalidateSubscriptionCache(organizationId: string): void {
  cache.delete(organizationId);
}
