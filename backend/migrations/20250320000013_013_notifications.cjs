/**
 * Multichannel notifications (email, VK Notify, Web Push); Telegram legacy retained.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS notify_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vk_notify_phone VARCHAR(32),
      ADD COLUMN IF NOT EXISTS vk_notify_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS webpush_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notify_events JSONB DEFAULT '{
        "anomaly_high": true,
        "anomaly_medium": false,
        "recommendation": true,
        "order_status": true,
        "price_report_weekly": false
      }'::jsonb;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS webpush_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_webpush_subs_org
      ON webpush_subscriptions(organization_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS webpush_subscriptions');
  await knex.raw(`
    ALTER TABLE organizations
      DROP COLUMN IF EXISTS notify_events,
      DROP COLUMN IF EXISTS webpush_enabled,
      DROP COLUMN IF EXISTS vk_notify_enabled,
      DROP COLUMN IF EXISTS vk_notify_phone,
      DROP COLUMN IF EXISTS notify_email_enabled,
      DROP COLUMN IF EXISTS notify_email;
  `);
};
