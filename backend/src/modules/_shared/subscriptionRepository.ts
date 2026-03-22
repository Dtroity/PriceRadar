import { pool } from '../../db/pool.js';
import { routeModuleCandidates } from '../../config/modules.js';
import * as orgModules from '../../models/organizationModulesModel.js';

const cache = new Map<string, { modules: Set<string>; at: number }>();
const TTL_MS = 15_000;

export async function organizationHasModule(organizationId: string, moduleKey: string): Promise<boolean> {
  const candidates = routeModuleCandidates(moduleKey);
  const cacheKey = `${organizationId}:${[...candidates].sort().join(',')}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < TTL_MS) {
    return cached.modules.has('__ok__');
  }

  const count = await orgModules.countModuleRows(organizationId);
  if (count > 0) {
    const ok = await orgModules.isAnyModuleEnabled(organizationId, candidates);
    cache.set(cacheKey, { modules: new Set(ok ? ['__ok__'] : []), at: now });
    return ok;
  }

  // Legacy: no organization_modules rows — fall back to plan_modules / subscriptions
  const { rows } = await pool.query(
    `SELECT pm.module_key
     FROM organization_subscriptions os
     JOIN plan_modules pm ON pm.plan_id = os.plan_id AND pm.enabled = TRUE
     WHERE os.organization_id = $1 AND os.status IN ('active', 'trial')`,
    [organizationId]
  );
  if (rows.length === 0) {
    const { rows: all } = await pool.query(`SELECT key FROM modules`);
    const enabled = new Set(all.map((r: { key: string }) => r.key));
    const ok = candidates.some((c) => enabled.has(c));
    cache.set(cacheKey, { modules: new Set(ok ? ['__ok__'] : []), at: now });
    return ok;
  }
  const modules = new Set(rows.map((r: { module_key: string }) => r.module_key));
  const ok = candidates.some((c) => modules.has(c));
  cache.set(cacheKey, { modules: new Set(ok ? ['__ok__'] : []), at: now });
  return ok;
}

export function invalidateSubscriptionCache(organizationId: string): void {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(`${organizationId}:`)) cache.delete(k);
  }
}
