/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS parse_source VARCHAR(10)`);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE documents DROP COLUMN IF EXISTS parse_source`);
};
