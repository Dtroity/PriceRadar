/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE product_stock ADD COLUMN IF NOT EXISTS min_stock NUMERIC(14,4) NOT NULL DEFAULT 0;
  `);
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS procurement_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      reason VARCHAR(30) NOT NULL
        CHECK (reason IN ('low_stock','price_drop','regular_cycle')),
      suggested_qty NUMERIC(12,3),
      suggested_price NUMERIC(12,2),
      priority SMALLINT DEFAULT 5,
      status VARCHAR(15) DEFAULT 'active'
        CHECK (status IN ('active','accepted','dismissed')),
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      order_id UUID REFERENCES procurement_orders(id) ON DELETE SET NULL
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_recs_org_status
      ON procurement_recommendations(organization_id, status, generated_at DESC);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS procurement_recommendations');
  await knex.raw('ALTER TABLE product_stock DROP COLUMN IF EXISTS min_stock');
};
