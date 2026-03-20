/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_confidence DOUBLE PRECISION`
  );
  await knex.raw(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_engine VARCHAR(20)`);

  await knex.raw(`ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;`);
  await knex.raw(`
    ALTER TABLE documents ADD CONSTRAINT documents_status_check
    CHECK (status IN ('pending', 'parsed', 'needs_review', 'verified', 'failed', 'ocr_failed'));
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;`);
  await knex.raw(`
    ALTER TABLE documents ADD CONSTRAINT documents_status_check
    CHECK (status IN ('pending', 'parsed', 'needs_review', 'verified', 'failed'));
  `);

  await knex.raw(`ALTER TABLE documents DROP COLUMN IF EXISTS ocr_confidence`);
  await knex.raw(`ALTER TABLE documents DROP COLUMN IF EXISTS ocr_engine`);
};
