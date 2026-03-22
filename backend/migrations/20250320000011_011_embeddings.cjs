/**
 * pgvector embeddings for product deduplication (Yandex text-search-doc, dim 256).
 * Extension creation cannot run inside a transaction on some Postgres builds.
 * @param {import('knex').Knex} knex
 */
exports.config = { transaction: false };

exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector;');
  await knex.raw(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS name_embedding vector(256);
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_products_embedding
      ON products USING ivfflat (name_embedding vector_cosine_ops)
      WITH (lists = 50);
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_products_embedding;');
  await knex.raw('ALTER TABLE products DROP COLUMN IF EXISTS name_embedding;');
};
