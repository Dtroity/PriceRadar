/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
      ADD COLUMN IF NOT EXISTS telegram_notify JSONB DEFAULT '{
        "anomaly_high": true,
        "anomaly_medium": false,
        "recommendation": true,
        "order_status": true
      }'::jsonb;
  `);
  await knex.raw(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS iiko_api_url VARCHAR(255),
      ADD COLUMN IF NOT EXISTS iiko_api_key VARCHAR(255);
  `);
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS iiko_sync_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      items_created INT DEFAULT 0,
      items_updated INT DEFAULT 0,
      errors JSONB,
      duration_ms INT
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS iiko_sync_log');
  await knex.raw(`
    ALTER TABLE organizations
      DROP COLUMN IF EXISTS telegram_chat_id,
      DROP COLUMN IF EXISTS telegram_notify,
      DROP COLUMN IF EXISTS iiko_api_url,
      DROP COLUMN IF EXISTS iiko_api_key;
  `);
};
