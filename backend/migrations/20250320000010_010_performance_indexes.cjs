/**
 * Composite indexes for analytics and procurement hot paths.
 * Note: `prices` is scoped via `price_lists.organization_id`, not a column on `prices`.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_prices_list_product_created
      ON prices(price_list_id, product_id, created_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_price_lists_org_supplier
      ON price_lists(organization_id, supplier_id);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_anomalies_org_ack_detected
      ON price_anomalies(organization_id, acknowledged, detected_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_product_created
      ON product_audit_log(product_id, created_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_proc_orders_org_status
      ON procurement_orders(organization_id, status, created_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_recs_org_status_product
      ON procurement_recommendations(organization_id, status, product_id);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_documents_org_status
      ON documents(organization_id, status, created_at DESC);
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_documents_org_status');
  await knex.raw('DROP INDEX IF EXISTS idx_recs_org_status_product');
  await knex.raw('DROP INDEX IF EXISTS idx_proc_orders_org_status');
  await knex.raw('DROP INDEX IF EXISTS idx_audit_product_created');
  await knex.raw('DROP INDEX IF EXISTS idx_anomalies_org_ack_detected');
  await knex.raw('DROP INDEX IF EXISTS idx_price_lists_org_supplier');
  await knex.raw('DROP INDEX IF EXISTS idx_prices_list_product_created');
};
