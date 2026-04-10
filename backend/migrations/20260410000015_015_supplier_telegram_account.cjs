/**
 * Add supplier telegram account (username/link).
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('suppliers', 'telegram_account');
  if (!has) {
    await knex.schema.alterTable('suppliers', (t) => {
      t.string('telegram_account', 64).nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  // keep user data by default; do nothing
};

