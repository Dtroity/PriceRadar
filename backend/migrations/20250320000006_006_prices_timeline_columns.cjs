/**
 * Timeline + document link for analytics (prices table originally had no created_at).
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`);
  await knex.raw(`
    UPDATE prices p
    SET created_at = pl.created_at
    FROM price_lists pl
    WHERE p.price_list_id = pl.id AND p.created_at IS NULL
  `);
  await knex.raw(`ALTER TABLE prices ALTER COLUMN created_at SET DEFAULT NOW()`);
  await knex.raw(`
    ALTER TABLE prices ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE prices DROP COLUMN IF EXISTS document_id`);
  await knex.raw(`ALTER TABLE prices DROP COLUMN IF EXISTS created_at`);
};
