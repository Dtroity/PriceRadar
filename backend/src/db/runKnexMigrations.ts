import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import knexFactory from 'knex';
import type { Knex } from 'knex';

/**
 * Runs Knex migrations (backend/knexfile.cjs, backend/migrations/*.cjs).
 * Resolves knexfile from repo root: dist/db -> ../../knexfile.cjs
 */
export async function runKnexMigrations(): Promise<number> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const knexfilePath = path.resolve(__dirname, '..', '..', 'knexfile.cjs');
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const knexfile = require(knexfilePath) as {
    development: Knex.Config;
    production: Knex.Config;
    test: Knex.Config;
  };
  const env =
    process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NODE_ENV === 'test'
        ? 'test'
        : 'development';
  const cfg = knexfile[env];
  const db = knexFactory(cfg);
  try {
    const [, log] = await db.migrate.latest();
    return Array.isArray(log) ? log.length : 0;
  } finally {
    await db.destroy();
  }
}
