/**
 * Add user active flag for blocking.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('users', 'is_active');
  if (!has) {
    await knex.schema.alterTable('users', (t) => {
      t.boolean('is_active').notNullable().defaultTo(true);
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  // keep user data by default; do nothing
};

