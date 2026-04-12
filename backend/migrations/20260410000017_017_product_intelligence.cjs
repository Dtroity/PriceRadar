/**
 * Product Intelligence: metrics, favorites, search support
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS product_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      usage_count INT NOT NULL DEFAULT 0,
      last_used_at TIMESTAMPTZ,
      price_std_dev NUMERIC(14, 4) NOT NULL DEFAULT 0,
      priority_score NUMERIC(14, 4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id)
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_metrics_product ON product_metrics(product_id);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_metrics_org ON product_metrics(organization_id);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_metrics_priority ON product_metrics(organization_id, priority_score DESC);
  `);
  await knex.raw(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_products_org_favorite ON products(organization_id, is_favorite DESC)
      WHERE is_favorite = TRUE;
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_products_name_trgm;');
  await knex.raw('DROP INDEX IF EXISTS idx_products_org_favorite;');
  await knex.raw('ALTER TABLE products DROP COLUMN IF EXISTS is_favorite;');
  await knex.raw('DROP TABLE IF EXISTS product_metrics;');
};
