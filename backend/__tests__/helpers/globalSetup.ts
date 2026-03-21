import 'dotenv/config';
import { runKnexMigrations } from '../../src/db/runKnexMigrations.js';

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for tests (set in .env or docker-compose.test.yml)');
  }
  const n = await runKnexMigrations();
  // eslint-disable-next-line no-console
  console.log(`[test] Migrations applied: ${n}`);
}
