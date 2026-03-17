import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = join(__dirname, 'schema-procureai.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('ProcureAI migration completed.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
