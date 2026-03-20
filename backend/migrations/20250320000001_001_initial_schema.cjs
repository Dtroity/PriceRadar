const fs = require('fs');
const path = require('path');

/** CREATE EXTENSION cannot run inside a transaction */
exports.config = { transaction: false };

function loadInitSql() {
  const candidates = [
    path.join(__dirname, '..', 'db-init.sql'),
    path.join(process.cwd(), 'db-init.sql'),
    path.join(process.cwd(), 'db', 'init.sql'),
    path.join(process.cwd(), '..', 'db', 'init.sql'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error(
    'Migration 001: db/init.sql not found. In Docker ensure /app/db-init.sql exists.'
  );
}

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const sql = loadInitSql();
  await knex.raw(sql);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down() {
  // Irreversible baseline
};
