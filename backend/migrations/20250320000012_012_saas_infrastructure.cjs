/**
 * SaaS: org plan, per-org modules, super-admin audit.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free'
        CHECK (plan IN ('free','pro','enterprise')),
      ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 3,
      ADD COLUMN IF NOT EXISTS max_documents_mo INT DEFAULT 50,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS industry VARCHAR(80);
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS organization_modules (
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      module VARCHAR(80) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      enabled_at TIMESTAMPTZ DEFAULT NOW(),
      enabled_by UUID REFERENCES users(id),
      PRIMARY KEY (organization_id, module)
    );
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID NOT NULL REFERENCES users(id),
      organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created
      ON admin_audit_log(created_at DESC);
  `);

  // Existing orgs: enable all known module keys so behaviour stays permissive until admin trims.
  await knex.raw(`
    INSERT INTO organization_modules (organization_id, module, enabled)
    SELECT o.id, m.key, TRUE
    FROM organizations o
    CROSS JOIN modules m
    ON CONFLICT (organization_id, module) DO NOTHING;
  `);
  await knex.raw(`
    INSERT INTO organization_modules (organization_id, module, enabled)
    SELECT o.id, x.module, TRUE
    FROM organizations o
    CROSS JOIN (
      VALUES
        ('analytics'),
        ('anomaly_detection'),
        ('procurement'),
        ('recommendations'),
        ('notifications_email'),
        ('notifications_vk'),
        ('notifications_push'),
        ('ai_features')
    ) AS x(module)
    ON CONFLICT (organization_id, module) DO NOTHING;
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS admin_audit_log');
  await knex.raw('DROP TABLE IF EXISTS organization_modules');
  await knex.raw(`
    ALTER TABLE organizations
      DROP COLUMN IF EXISTS industry,
      DROP COLUMN IF EXISTS notes,
      DROP COLUMN IF EXISTS max_documents_mo,
      DROP COLUMN IF EXISTS max_users,
      DROP COLUMN IF EXISTS is_active,
      DROP COLUMN IF EXISTS plan_expires_at,
      DROP COLUMN IF EXISTS plan;
  `);
};
