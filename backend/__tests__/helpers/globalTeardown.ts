import { pool } from '../../src/db/pool.js';

export default async function globalTeardown(): Promise<void> {
  await pool.end();
}
