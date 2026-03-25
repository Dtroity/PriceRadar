/**
 * Supplier Portal (AZbot replacement):
 * - suppliers contact + notification routing fields
 * - supplier_filters, order_dispatches, order_messages
 * - notification_settings (org-level matrix for future)
 * - user roles: employee + supplier
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  // --- suppliers: contact + channel fields ---
  await knex.schema.alterTable('suppliers', (t) => {
    t.string('contact_name', 100).nullable();
    t.string('email', 255).nullable();
    t.string('phone', 30).nullable();
    t.bigInteger('telegram_chat_id').nullable();
    t.string('notify_channel', 20).notNullable().defaultTo('email'); // email | telegram | both | none
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('invite_token', 64).nullable().unique();
    t
      .uuid('account_user_id')
      .nullable()
      .references('id')
      .inTable('users');
  });

  // --- supplier_filters ---
  const hasSupplierFilters = await knex.schema.hasTable('supplier_filters');
  if (!hasSupplierFilters) {
    await knex.schema.createTable('supplier_filters', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t
        .uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');
      t
        .uuid('supplier_id')
        .notNullable()
        .references('id')
        .inTable('suppliers')
        .onDelete('CASCADE');
      t.string('keyword', 100).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['supplier_id', 'keyword']);
    });
  }
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_supplier_filters_org ON supplier_filters(organization_id)'
  );

  // --- order_dispatches ---
  const hasDispatches = await knex.schema.hasTable('order_dispatches');
  if (!hasDispatches) {
    await knex.schema.createTable('order_dispatches', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t
        .uuid('order_id')
        .notNullable()
        .references('id')
        .inTable('procurement_orders')
        .onDelete('CASCADE');
      t
        .uuid('supplier_id')
        .notNullable()
        .references('id')
        .inTable('suppliers');
      t
        .uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations');
      t.string('status', 20).notNullable().defaultTo('sent'); // sent | accepted | rejected | partial | completed
      t
        .string('access_token', 64)
        .notNullable()
        .unique()
        .defaultTo(knex.raw('gen_random_uuid()::text'));
      t
        .timestamp('token_expires_at')
        .notNullable()
        .defaultTo(knex.raw("NOW() + INTERVAL '7 days'"));
      t.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('responded_at').nullable();
      t.text('supplier_note').nullable();
    });
  }
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_order_dispatches_order ON order_dispatches(order_id)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_order_dispatches_token ON order_dispatches(access_token)'
  );

  // --- order_messages ---
  const hasMessages = await knex.schema.hasTable('order_messages');
  if (!hasMessages) {
    await knex.schema.createTable('order_messages', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t
        .uuid('dispatch_id')
        .notNullable()
        .references('id')
        .inTable('order_dispatches')
        .onDelete('CASCADE');
      t.string('sender_type', 10).notNullable(); // supplier | manager
      t.uuid('sender_id').nullable();
      t.string('sender_name', 100).nullable();
      t.text('message').notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('read_at').nullable();
    });
  }
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_order_messages_dispatch ON order_messages(dispatch_id, created_at ASC)'
  );

  // --- notification_settings (future matrix; not yet wired in API) ---
  const hasNotificationSettings = await knex.schema.hasTable('notification_settings');
  if (!hasNotificationSettings) {
    await knex.schema.createTable('notification_settings', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t
        .uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');
      t.string('event_type', 50).notNullable();
      t.string('channel', 20).notNullable();
      t.boolean('enabled').notNullable().defaultTo(true);
      t
        .jsonb('include_details')
        .notNullable()
        .defaultTo(JSON.stringify({ items: false, total: false, link: true }));
      t.unique(['organization_id', 'event_type', 'channel']);
    });
  }

  // --- user roles: employee + supplier ---
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('super_admin','org_admin','manager','employee','supplier'));
  `);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('order_messages');
  await knex.schema.dropTableIfExists('order_dispatches');
  await knex.schema.dropTableIfExists('supplier_filters');
  await knex.schema.dropTableIfExists('notification_settings');
  // suppliers columns are intentionally not dropped (may contain user data)
};

