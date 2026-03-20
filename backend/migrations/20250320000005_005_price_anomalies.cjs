/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS price_anomalies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      price_before NUMERIC(12,2) NOT NULL,
      price_after NUMERIC(12,2) NOT NULL,
      change_pct NUMERIC(8,2) NOT NULL,
      direction VARCHAR(4) NOT NULL CHECK (direction IN ('up','down')),
      severity VARCHAR(6) NOT NULL CHECK (severity IN ('low','medium','high')),
      document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
      acknowledged BOOLEAN DEFAULT FALSE,
      acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
      acknowledged_at TIMESTAMPTZ
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_anomalies_org_detected
      ON price_anomalies(organization_id, detected_at DESC);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_anomalies_product
      ON price_anomalies(product_id, detected_at DESC);
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS price_anomalies');
};
