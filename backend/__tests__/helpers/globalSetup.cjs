'use strict';

const { execSync } = require('child_process');
const path = require('path');

const backendRoot = path.resolve(__dirname, '../..');

module.exports = async function globalSetup() {
  require('dotenv').config({ path: path.join(backendRoot, '.env') });
  require('dotenv').config({ path: path.join(backendRoot, '.env.test'), override: true });

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for integration tests (set in .env.test or environment; see .env.test.example)'
    );
  }

  // eslint-disable-next-line no-console
  console.log('[test] Running DB migrations (knex migrate:latest --env test)...');
  try {
    execSync('npx knex migrate:latest --knexfile knexfile.cjs --env test', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: { ...process.env },
    });
    // eslint-disable-next-line no-console
    console.log('[test] Migrations applied successfully');
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? '';
    const stdout = err.stdout?.toString?.() ?? '';
    // eslint-disable-next-line no-console
    console.error('[test] Migration failed:', stderr || stdout || err.message);
    throw err;
  }
};
