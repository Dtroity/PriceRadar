import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema-phase34-stock.sql'), 'utf-8');
  await pool.query(sql);
  const { rows: plans } = await pool.query(`SELECT id FROM subscription_plans WHERE name = 'Enterprise' LIMIT 1`);
  if (plans[0]) {
    for (const key of ['stock', 'procurement_autopilot']) {
      await pool.query(
        `INSERT INTO plan_modules (plan_id, module_key, enabled) VALUES ($1, $2, TRUE) ON CONFLICT (plan_id, module_key) DO NOTHING`,
        [plans[0].id, key]
      );
    }
  }
  console.log('Phase 3.4 migration completed.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
