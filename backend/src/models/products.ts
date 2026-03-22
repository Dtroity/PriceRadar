import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import type { Product } from '../types/index.js';
import { insertAudit } from './productAuditLog.js';
import { refreshProductEmbedding } from '../services/embeddingService.js';

export async function getAllProducts(organizationId?: string): Promise<Product[]> {
  if (organizationId) {
    const { rows } = await pool.query(
      'SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE organization_id = $1 ORDER BY is_priority DESC, name',
      [organizationId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    'SELECT id, name, normalized_name, is_priority, created_at FROM products ORDER BY is_priority DESC, name'
  );
  return rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  const { rows } = await pool.query(
    'SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function findProductByNormalizedName(normalizedName: string, organizationId?: string): Promise<Product | null> {
  if (organizationId) {
    const { rows } = await pool.query(
      'SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE organization_id = $1 AND normalized_name = $2',
      [organizationId, normalizedName]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query(
    'SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE normalized_name = $1',
    [normalizedName]
  );
  return rows[0] ?? null;
}

export async function createProduct(
  name: string,
  normalizedName: string,
  isPriority = false,
  organizationId?: string
): Promise<Product> {
  if (organizationId) {
    const { rows } = await pool.query(
      `INSERT INTO products (organization_id, name, normalized_name, is_priority) VALUES ($1, $2, $3, $4)
       RETURNING id, name, normalized_name, is_priority, created_at`,
      [organizationId, name, normalizedName, isPriority]
    );
    const row = rows[0];
    void refreshProductEmbedding(row.id, organizationId, name);
    return row;
  }
  const { rows } = await pool.query(
    `INSERT INTO products (name, normalized_name, is_priority) VALUES ($1, $2, $3)
     RETURNING id, name, normalized_name, is_priority, created_at`,
    [name, normalizedName, isPriority]
  );
  return rows[0];
}

export async function findOrCreateProduct(
  name: string,
  normalizedName: string,
  isPriority = false,
  organizationId?: string
): Promise<Product> {
  const existing = await findProductByNormalizedName(normalizedName, organizationId);
  if (existing) {
    if (isPriority && !existing.is_priority) {
      await pool.query('UPDATE products SET is_priority = TRUE WHERE id = $1', [existing.id]);
      return { ...existing, is_priority: true };
    }
    return existing;
  }
  return createProduct(name, normalizedName, isPriority, organizationId);
}

export async function setProductPriority(productId: string, isPriority: boolean): Promise<void> {
  await pool.query('UPDATE products SET is_priority = $1 WHERE id = $2', [isPriority, productId]);
}

export async function setProductPriorityWithAudit(
  productId: string,
  isPriority: boolean,
  organizationId: string,
  actorUserId: string | null
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ is_priority: boolean }>(
      'SELECT is_priority FROM products WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [productId, organizationId]
    );
    if (!rows[0]) {
      const err = new Error('Product not found');
      (err as Error & { status?: number }).status = 404;
      throw err;
    }
    const oldVal = rows[0].is_priority;
    await client.query('UPDATE products SET is_priority = $1 WHERE id = $2', [isPriority, productId]);
    await insertAudit(
      {
        organizationId,
        productId,
        action: 'update',
        actorId: actorUserId,
        meta: { field: 'is_priority', oldValue: oldVal, newValue: isPriority },
      },
      client
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function findProductByNormalizedNameWithClient(
  client: PoolClient,
  normalizedName: string,
  organizationId: string
): Promise<Product | null> {
  const { rows } = await client.query<Product>(
    'SELECT id, name, normalized_name, is_priority, created_at FROM products WHERE organization_id = $1 AND normalized_name = $2',
    [organizationId, normalizedName]
  );
  return rows[0] ?? null;
}

async function createProductWithClient(
  client: PoolClient,
  name: string,
  normalizedName: string,
  isPriority: boolean,
  organizationId: string
): Promise<Product> {
  const { rows } = await client.query<Product>(
    `INSERT INTO products (organization_id, name, normalized_name, is_priority) VALUES ($1, $2, $3, $4)
     RETURNING id, name, normalized_name, is_priority, created_at`,
    [organizationId, name, normalizedName, isPriority]
  );
  return rows[0];
}

async function findOrCreateProductWithClient(
  client: PoolClient,
  name: string,
  normalizedName: string,
  isPriority: boolean,
  organizationId: string
): Promise<Product> {
  const existing = await findProductByNormalizedNameWithClient(client, normalizedName, organizationId);
  if (existing) {
    if (isPriority && !existing.is_priority) {
      await client.query('UPDATE products SET is_priority = TRUE WHERE id = $1', [existing.id]);
      return { ...existing, is_priority: true };
    }
    return existing;
  }
  return createProductWithClient(client, name, normalizedName, isPriority, organizationId);
}

/**
 * Alias normalization + ensure product + audit in a single transaction.
 */
export async function normalizeAliasesAndAuditTransaction(
  organizationId: string,
  rawNames: string[],
  targetDisplayName: string,
  normalizedTarget: string,
  actorUserId: string | null
): Promise<{ updated: number }> {
  const cleaned = rawNames.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length) {
    const err = new Error('empty rawNames');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE product_aliases
       SET normalized_name = $1
       WHERE organization_id = $2 AND raw_name = ANY($3::text[])`,
      [normalizedTarget.trim(), organizationId, cleaned]
    );
    const updated = rowCount ?? 0;
    const product = await findOrCreateProductWithClient(
      client,
      targetDisplayName,
      normalizedTarget,
      false,
      organizationId
    );
    await insertAudit(
      {
        organizationId,
        productId: product.id,
        action: 'normalize',
        actorId: actorUserId,
        meta: { rawNames: cleaned, targetNormalizedName: normalizedTarget, updated },
      },
      client
    );
    await client.query('COMMIT');
    void refreshProductEmbedding(product.id, organizationId, targetDisplayName);
    return { updated };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export interface MergeProductsParams {
  organizationId: string;
  targetProductId: string;
  sourceProductIds: string[];
  /** User who performed merge (null for system / auto-merge) */
  actorUserId?: string | null;
}

export interface MergeProductsResult {
  mergedSourceIds: string[];
}

/**
 * Atomically reassigns all product_id FKs from sources to target, merges stock / dedupes
 * where unique constraints apply, then deletes source product rows.
 */
export async function mergeProducts(params: MergeProductsParams): Promise<MergeProductsResult> {
  const { organizationId, targetProductId } = params;
  const sourceProductIds = [
    ...new Set(params.sourceProductIds.map((id) => id.trim()).filter(Boolean)),
  ].filter((id) => id !== targetProductId);

  if (sourceProductIds.length === 0) {
    const err = new Error('NO_SOURCES: no source products or target listed only in sources');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allIds = [targetProductId, ...sourceProductIds];
    const { rows: found } = await client.query<{ id: string }>(
      `SELECT id FROM products WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
      [organizationId, allIds]
    );
    if (found.length !== allIds.length) {
      const err = new Error('INVALID_PRODUCTS: not found or different organization');
      (err as Error & { status?: number }).status = 400;
      throw err;
    }

    const src = sourceProductIds;
    const tgt = targetProductId;

    // iiko: drop source mappings when target already has one for the same org
    await client.query(
      `DELETE FROM iiko_products_mapping AS s
       USING iiko_products_mapping AS t
       WHERE s.organization_id = t.organization_id
         AND t.product_id = $1::uuid
         AND s.product_id = ANY($2::uuid[])`,
      [tgt, src]
    );

    // Dedupe iiko rows among sources (same org) so UPDATE → target cannot violate UNIQUE
    await client.query(
      `DELETE FROM iiko_products_mapping AS a
       USING iiko_products_mapping AS b
       WHERE a.organization_id = b.organization_id
         AND a.product_id = ANY($1::uuid[])
         AND b.product_id = ANY($1::uuid[])
         AND a.id > b.id`,
      [src]
    );

    const fkUpdates: Array<[string, string]> = [
      ['prices', 'product_id'],
      ['price_changes', 'product_id'],
      ['document_items', 'product_id'],
      ['price_forecasts', 'product_id'],
      ['ai_feedback', 'product_id'],
      ['product_mapping', 'product_id'],
      ['product_aliases', 'product_id'],
      ['recipe_items', 'product_id'],
      ['supplier_prices_history', 'product_id'],
      ['supplier_order_items', 'product_id'],
      ['stock_movements', 'product_id'],
    ];

    for (const [table, col] of fkUpdates) {
      await client.query(`UPDATE ${table} SET ${col} = $1::uuid WHERE ${col} = ANY($2::uuid[])`, [
        tgt,
        src,
      ]);
    }

    await client.query(
      `UPDATE iiko_products_mapping SET product_id = $1::uuid WHERE product_id = ANY($2::uuid[])`,
      [tgt, src]
    );

    // Merge stock: add summed source quantities into target, then remove source rows
    const { rows: sumRows } = await client.query<{ s: string }>(
      `SELECT COALESCE(SUM(current_stock), 0) AS s
       FROM product_stock
       WHERE organization_id = $1::uuid AND product_id = ANY($2::uuid[])`,
      [organizationId, src]
    );
    const addQty = Number(sumRows[0]?.s ?? 0);
    const updStock = await client.query(
      `UPDATE product_stock
       SET current_stock = current_stock + $1::numeric, updated_at = NOW()
       WHERE organization_id = $2::uuid AND product_id = $3::uuid`,
      [addQty, organizationId, tgt]
    );
    if (updStock.rowCount === 0 && addQty !== 0) {
      const { rows: urow } = await client.query<{ unit: string | null }>(
        `SELECT unit FROM product_stock
         WHERE organization_id = $1::uuid AND product_id = ANY($2::uuid[])
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [organizationId, src]
      );
      await client.query(
        `INSERT INTO product_stock (organization_id, product_id, current_stock, unit)
         VALUES ($1::uuid, $2::uuid, $3::numeric, COALESCE($4, 'kg'))`,
        [organizationId, tgt, addQty, urow[0]?.unit ?? 'kg']
      );
    }
    await client.query(
      `DELETE FROM product_stock
       WHERE organization_id = $1::uuid AND product_id = ANY($2::uuid[])`,
      [organizationId, src]
    );

    // Same price list + product: keep one row
    await client.query(
      `DELETE FROM prices AS a
       USING prices AS b
       WHERE a.id > b.id
         AND a.price_list_id = b.price_list_id
         AND a.product_id = b.product_id
         AND a.product_id = $1::uuid`,
      [tgt]
    );

    await client.query(
      `DELETE FROM supplier_prices_history AS a
       USING supplier_prices_history AS b
       WHERE a.id > b.id
         AND a.organization_id = b.organization_id
         AND a.supplier_id = b.supplier_id
         AND a.product_id = b.product_id
         AND a.date = b.date
         AND a.product_id = $1::uuid`,
      [tgt]
    );

    // recipe_items: merge quantities for same (recipe_id, product_id)
    await client.query(
      `WITH dup AS (
         SELECT recipe_id,
                product_id,
                SUM(quantity)::numeric AS total_q,
                MIN(id) AS keep_id,
                (array_agg(unit ORDER BY id))[1] AS u
         FROM recipe_items
         WHERE product_id = $1::uuid
         GROUP BY recipe_id, product_id
         HAVING COUNT(*) > 1
       )
       UPDATE recipe_items ri
       SET quantity = dup.total_q,
           unit = COALESCE(dup.u, ri.unit)
       FROM dup
       WHERE ri.id = dup.keep_id`,
      [tgt]
    );
    await client.query(
      `DELETE FROM recipe_items AS ri
       WHERE ri.product_id = $1::uuid
         AND EXISTS (
           SELECT 1
           FROM recipe_items ri2
           WHERE ri2.recipe_id = ri.recipe_id
             AND ri2.product_id = ri.product_id
             AND ri2.id < ri.id
         )`,
      [tgt]
    );

    await client.query(
      `WITH dup AS (
         SELECT order_id,
                product_id,
                SUM(quantity)::numeric AS total_q,
                MIN(id) AS keep_id
         FROM supplier_order_items
         WHERE product_id = $1::uuid
         GROUP BY order_id, product_id
         HAVING COUNT(*) > 1
       )
       UPDATE supplier_order_items oi
       SET quantity = dup.total_q
       FROM dup
       WHERE oi.id = dup.keep_id`,
      [tgt]
    );
    await client.query(
      `DELETE FROM supplier_order_items AS oi
       WHERE oi.product_id = $1::uuid
         AND EXISTS (
           SELECT 1
           FROM supplier_order_items oi2
           WHERE oi2.order_id = oi.order_id
             AND oi2.product_id = oi.product_id
             AND oi2.id < oi.id
         )`,
      [tgt]
    );

    await client.query(
      `DELETE FROM iiko_products_mapping AS a
       USING iiko_products_mapping AS b
       WHERE a.organization_id = b.organization_id
         AND a.product_id = b.product_id
         AND a.product_id = $1::uuid
         AND a.id > b.id`,
      [tgt]
    );

    await client.query(`DELETE FROM products WHERE organization_id = $1::uuid AND id = ANY($2::uuid[])`, [
      organizationId,
      src,
    ]);

    await client.query(
      `INSERT INTO product_audit_log (organization_id, product_id, action, actor_id, meta)
       VALUES ($1::uuid, $2::uuid, 'merge', $3::uuid, $4::jsonb)`,
      [
        organizationId,
        tgt,
        params.actorUserId ?? null,
        JSON.stringify({ sourceIds: sourceProductIds }),
      ]
    );

    await client.query('COMMIT');
    return { mergedSourceIds: sourceProductIds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
