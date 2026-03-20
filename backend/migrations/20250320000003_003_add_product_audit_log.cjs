/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('product_audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.string('action', 30).notNullable();
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.jsonb('meta');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_product_audit_log_product ON product_audit_log (product_id, created_at DESC)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_product_audit_log_org ON product_audit_log (organization_id, created_at DESC)'
  );
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('product_audit_log');
};
