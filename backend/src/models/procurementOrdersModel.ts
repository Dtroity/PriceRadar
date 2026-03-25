import { pool } from '../db/pool.js';
import type { ProcurementOrderStatus } from '../procurement/orderStatus.js';

export interface ProcurementOrderRow {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string | null;
  status: ProcurementOrderStatus;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: string;
  unit: string | null;
  target_price: string | null;
  actual_price: string | null;
  supplier_id: string | null;
  note: string | null;
  product_name?: string;
}

export interface ListFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  supplierId?: string;
  createdBy?: string;
}

export async function listOrders(
  organizationId: string,
  filters: ListFilters = {},
  limit = 100
): Promise<ProcurementOrderRow[]> {
  const cond = ['organization_id = $1::uuid'];
  const params: unknown[] = [organizationId];
  let i = 1;
  if (filters.status) {
    i++;
    cond.push(`status = $${i}`);
    params.push(filters.status);
  }
  if (filters.supplierId) {
    i++;
    cond.push(`supplier_id = $${i}::uuid`);
    params.push(filters.supplierId);
  }
  if (filters.createdBy) {
    i++;
    cond.push(`created_by = $${i}::uuid`);
    params.push(filters.createdBy);
  }
  if (filters.dateFrom) {
    i++;
    cond.push(`created_at >= $${i}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    i++;
    cond.push(`created_at < $${i}`);
    params.push(filters.dateTo);
  }
  i++;
  params.push(limit);
  const lim = i;
  const { rows } = await pool.query<ProcurementOrderRow>(
    `SELECT id, organization_id, created_by, title, status, supplier_id, notes, created_at, updated_at
     FROM procurement_orders
     WHERE ${cond.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${lim}`,
    params
  );
  return rows;
}

export async function createOrder(params: {
  organizationId: string;
  createdBy: string | null;
  title?: string | null;
  supplierId?: string | null;
  notes?: string | null;
}): Promise<ProcurementOrderRow> {
  const { rows } = await pool.query<ProcurementOrderRow>(
    `INSERT INTO procurement_orders (organization_id, created_by, title, supplier_id, notes, status)
     VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, 'draft')
     RETURNING id, organization_id, created_by, title, status, supplier_id, notes, created_at, updated_at`,
    [
      params.organizationId,
      params.createdBy,
      params.title ?? null,
      params.supplierId ?? null,
      params.notes ?? null,
    ]
  );
  return rows[0]!;
}

export async function getOrder(
  id: string,
  organizationId: string
): Promise<ProcurementOrderRow | null> {
  const { rows } = await pool.query<ProcurementOrderRow>(
    `SELECT id, organization_id, created_by, title, status, supplier_id, notes, created_at, updated_at
     FROM procurement_orders WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string): Promise<ProcurementItemRow[]> {
  const { rows } = await pool.query<ProcurementItemRow>(
    `SELECT pi.id, pi.order_id, pi.product_id, pi.quantity::text, pi.unit,
            pi.target_price::text, pi.actual_price::text, pi.supplier_id, pi.note,
            p.name AS product_name
     FROM procurement_items pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.order_id = $1::uuid
     ORDER BY pi.id`,
    [orderId]
  );
  return rows;
}

export async function orderTotalSum(orderId: string): Promise<number> {
  const { rows } = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(quantity * COALESCE(actual_price, target_price, 0)), 0)::text AS s
     FROM procurement_items WHERE order_id = $1::uuid`,
    [orderId]
  );
  return parseFloat(rows[0]?.s ?? '0');
}

export async function patchOrderHeader(
  id: string,
  organizationId: string,
  patch: {
    title?: string | null;
    supplier_id?: string | null;
    notes?: string | null;
  }
): Promise<ProcurementOrderRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [id, organizationId];
  let i = 2;
  if (patch.title !== undefined) {
    i++;
    sets.push(`title = $${i}`);
    vals.push(patch.title);
  }
  if (patch.supplier_id !== undefined) {
    i++;
    sets.push(`supplier_id = $${i}::uuid`);
    vals.push(patch.supplier_id);
  }
  if (patch.notes !== undefined) {
    i++;
    sets.push(`notes = $${i}`);
    vals.push(patch.notes);
  }
  if (sets.length === 0) return getOrder(id, organizationId);
  sets.push('updated_at = NOW()');
  const { rows } = await pool.query<ProcurementOrderRow>(
    `UPDATE procurement_orders SET ${sets.join(', ')}
     WHERE id = $1::uuid AND organization_id = $2::uuid
     RETURNING id, organization_id, created_by, title, status, supplier_id, notes, created_at, updated_at`,
    vals
  );
  return rows[0] ?? null;
}

export async function setOrderStatus(
  id: string,
  organizationId: string,
  status: ProcurementOrderStatus
): Promise<ProcurementOrderRow | null> {
  const { rows } = await pool.query<ProcurementOrderRow>(
    `UPDATE procurement_orders SET status = $3, updated_at = NOW()
     WHERE id = $1::uuid AND organization_id = $2::uuid
     RETURNING id, organization_id, created_by, title, status, supplier_id, notes, created_at, updated_at`,
    [id, organizationId, status]
  );
  return rows[0] ?? null;
}

export async function addItem(params: {
  orderId: string;
  productId: string;
  quantity: number;
  unit?: string | null;
  targetPrice?: number | null;
  supplierId?: string | null;
}): Promise<ProcurementItemRow> {
  const { rows } = await pool.query<ProcurementItemRow>(
    `INSERT INTO procurement_items (order_id, product_id, quantity, unit, target_price, supplier_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
     RETURNING id, order_id, product_id, quantity::text, unit, target_price::text, actual_price::text, supplier_id, note`,
    [
      params.orderId,
      params.productId,
      params.quantity,
      params.unit ?? null,
      params.targetPrice ?? null,
      params.supplierId ?? null,
    ]
  );
  const r = rows[0]!;
  const { rows: pn } = await pool.query<{ name: string }>('SELECT name FROM products WHERE id = $1', [
    params.productId,
  ]);
  return { ...r, product_name: pn[0]?.name };
}

export async function patchItem(
  orderId: string,
  itemId: string,
  patch: { quantity?: number; actual_price?: number | null; note?: string | null }
): Promise<ProcurementItemRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [orderId, itemId];
  let i = 2;
  if (patch.quantity !== undefined) {
    i++;
    sets.push(`quantity = $${i}`);
    vals.push(patch.quantity);
  }
  if (patch.actual_price !== undefined) {
    i++;
    sets.push(`actual_price = $${i}`);
    vals.push(patch.actual_price);
  }
  if (patch.note !== undefined) {
    i++;
    sets.push(`note = $${i}`);
    vals.push(patch.note);
  }
  if (sets.length === 0) {
    const { rows } = await pool.query<ProcurementItemRow>(
      `SELECT id, order_id, product_id, quantity::text, unit, target_price::text, actual_price::text, supplier_id, note
       FROM procurement_items WHERE id = $2::uuid AND order_id = $1::uuid`,
      [orderId, itemId]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query<ProcurementItemRow>(
    `UPDATE procurement_items SET ${sets.join(', ')}
     WHERE id = $2::uuid AND order_id = $1::uuid
     RETURNING id, order_id, product_id, quantity::text, unit, target_price::text, actual_price::text, supplier_id, note`,
    vals
  );
  return rows[0] ?? null;
}

export async function deleteItem(orderId: string, itemId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM procurement_items WHERE id = $1::uuid AND order_id = $2::uuid',
    [itemId, orderId]
  );
  return (rowCount ?? 0) > 0;
}

/** Latest price hint for a product (org-scoped). */
export async function getPriceHint(
  organizationId: string,
  productId: string
): Promise<{ target_price: number | null; supplier_id: string | null }> {
  const { rows } = await pool.query<{ price: string; supplier_id: string }>(
    `SELECT sph.price::text, sph.supplier_id::text
     FROM supplier_prices_history sph
     WHERE sph.organization_id = $1::uuid AND sph.product_id = $2::uuid
     ORDER BY sph.date DESC, sph.created_at DESC
     LIMIT 1`,
    [organizationId, productId]
  );
  if (!rows[0]) return { target_price: null, supplier_id: null };
  return {
    target_price: parseFloat(rows[0].price),
    supplier_id: rows[0].supplier_id,
  };
}
