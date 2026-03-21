/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS procurement_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','pending','approved','ordered','received','cancelled')),
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS procurement_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL,
      unit VARCHAR(20),
      target_price NUMERIC(12,2),
      actual_price NUMERIC(12,2),
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      note TEXT
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_proc_orders_org ON procurement_orders(organization_id, created_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_proc_items_order ON procurement_items(order_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS procurement_items');
  await knex.raw('DROP TABLE IF EXISTS procurement_orders');
};
