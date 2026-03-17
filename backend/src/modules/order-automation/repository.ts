import { pool } from '../../db/pool.js';
import type { SupplierOrder, SupplierOrderItem, SupplierOrderFilter, SupplierContact, AutomationRule } from './types.js';

export async function createOrder(
  organizationId: string,
  supplierId: string,
  notes: string | null,
  createdBy: string | null,
  items: { product_id: string; quantity: number; price?: number | null }[],
  generatedByAi = false
): Promise<SupplierOrder> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: o } = await client.query(
      `INSERT INTO supplier_orders (organization_id, supplier_id, status, notes, created_by, generated_by_ai)
       VALUES ($1, $2, 'draft', $3, $4, $5)
       RETURNING id, organization_id, supplier_id, status, notes, created_by, created_at, sent_at, updated_at`,
      [organizationId, supplierId, notes, createdBy, generatedByAi]
    );
    const order = o[0] as SupplierOrder;
    for (const it of items) {
      await client.query(
        `INSERT INTO supplier_order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, it.product_id, it.quantity, it.price ?? null]
      );
    }
    await client.query('COMMIT');
    return order;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listOrders(organizationId: string, limit = 100): Promise<SupplierOrder[]> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, supplier_id, status, notes, created_by, created_at, sent_at, updated_at
     FROM supplier_orders WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [organizationId, limit]
  );
  return rows;
}

export async function getOrder(orderId: string, organizationId: string): Promise<SupplierOrder | null> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, supplier_id, status, notes, created_by, created_at, sent_at, updated_at
     FROM supplier_orders WHERE id = $1 AND organization_id = $2`,
    [orderId, organizationId]
  );
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string): Promise<SupplierOrderItem[]> {
  const { rows } = await pool.query(
    `SELECT id, order_id, product_id, quantity, price, created_at FROM supplier_order_items WHERE order_id = $1`,
    [orderId]
  );
  return rows;
}

export async function updateOrderStatus(
  orderId: string,
  organizationId: string,
  status: string,
  sentAt?: Date | null
): Promise<void> {
  await pool.query(
    `UPDATE supplier_orders SET status = $3, sent_at = COALESCE($4, sent_at), updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [orderId, organizationId, status, sentAt ?? null]
  );
}

/** AZbot-style: match line text to supplier by keyword filters */
export async function findSupplierByLine(organizationId: string, line: string): Promise<string | null> {
  const lower = line.toLowerCase();
  const { rows } = await pool.query(
    `SELECT supplier_id, priority FROM supplier_order_filters
     WHERE organization_id = $1 AND active = TRUE AND LOWER($2) LIKE '%' || LOWER(keyword) || '%'
     ORDER BY priority DESC LIMIT 1`,
    [organizationId, line]
  );
  return rows[0]?.supplier_id ?? null;
}

export async function listFilters(organizationId: string): Promise<SupplierOrderFilter[]> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, supplier_id, keyword, priority, active, created_at
     FROM supplier_order_filters WHERE organization_id = $1 ORDER BY priority DESC, keyword`,
    [organizationId]
  );
  return rows;
}

export async function upsertFilter(
  organizationId: string,
  supplierId: string,
  keyword: string,
  priority: number
): Promise<void> {
  await pool.query(
    `INSERT INTO supplier_order_filters (organization_id, supplier_id, keyword, priority, active)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [organizationId, supplierId, keyword.trim(), priority]
  );
}

export async function deleteFilter(id: string, organizationId: string): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM supplier_order_filters WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listContacts(supplierId: string): Promise<SupplierContact[]> {
  const { rows } = await pool.query(
    `SELECT id, supplier_id, type, value, created_at FROM supplier_contacts WHERE supplier_id = $1`,
    [supplierId]
  );
  return rows;
}

export async function addContact(
  supplierId: string,
  type: string,
  value: string
): Promise<void> {
  await pool.query(
    `INSERT INTO supplier_contacts (supplier_id, type, value) VALUES ($1, $2, $3)`,
    [supplierId, type, value]
  );
}

export async function listRules(organizationId: string): Promise<AutomationRule[]> {
  const { rows } = await pool.query(
    `SELECT id, organization_id, rule_type, conditions, actions, enabled, created_at
     FROM automation_rules WHERE organization_id = $1 ORDER BY created_at DESC`,
    [organizationId]
  );
  return rows;
}

export async function createRule(
  organizationId: string,
  ruleType: string,
  conditions: Record<string, unknown>,
  actions: Record<string, unknown>
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO automation_rules (organization_id, rule_type, conditions, actions, enabled)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, TRUE) RETURNING id`,
    [organizationId, ruleType, JSON.stringify(conditions), JSON.stringify(actions)]
  );
  return rows[0].id;
}
