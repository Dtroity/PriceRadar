import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { sendSupplierOrderEmail } from './emailNotifier.js';
import { sendTelegramRaw } from './telegramNotifier.js';

type ProcurementItem = {
  id: string;
  product_id: string;
  quantity: string;
  unit: string | null;
  product_name: string;
};

type SupplierRow = {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  notify_channel: 'email' | 'telegram' | 'both' | 'none' | string;
  is_active: boolean;
  keywords: string[] | null;
};

export async function dispatchOrder(orderId: string, orgId: string): Promise<void> {
  const existing = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM order_dispatches WHERE order_id = $1::uuid`,
    [orderId]
  );
  if (parseInt(existing.rows[0]?.n ?? '0', 10) > 0) {
    logger.info({ orderId }, 'dispatchOrder: dispatches already exist, skip');
    return;
  }

  const itemsRes = await pool.query<ProcurementItem>(
    `
    SELECT pi.id, pi.product_id, pi.quantity::text, pi.unit, p.name as product_name
    FROM procurement_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.order_id = $1::uuid
    `,
    [orderId]
  );
  const items = itemsRes.rows;
  if (items.length === 0) {
    logger.info({ orderId }, 'dispatchOrder: no items, skip');
    return;
  }

  const suppliersRes = await pool.query<SupplierRow>(
    `
    SELECT
      s.*,
      COALESCE(array_agg(f.keyword) FILTER (WHERE f.keyword IS NOT NULL), '{}'::text[]) AS keywords
    FROM suppliers s
    LEFT JOIN supplier_filters f ON f.supplier_id = s.id
    WHERE s.organization_id = $1::uuid AND s.is_active = true
    GROUP BY s.id
    `,
    [orgId]
  );
  const suppliers = suppliersRes.rows;
  if (suppliers.length === 0) {
    logger.warn({ orderId, orgId }, 'dispatchOrder: no active suppliers, all items unmatched');
  }

  const { rows: orgRows } = await pool.query<{ name: string }>(
    `SELECT name FROM organizations WHERE id = $1::uuid`,
    [orgId]
  );
  const restaurantName = orgRows[0]?.name ?? 'Ресторан';

  const dispatches = new Map<string, ProcurementItem[]>();
  const unmatched: ProcurementItem[] = [];

  for (const item of items) {
    const name = (item.product_name ?? '').toLowerCase();
    let matchedSupplierId: string | null = null;

    for (const supplier of suppliers) {
      const keywords = (supplier.keywords ?? []).filter(Boolean);
      const hit = keywords.some((kw) => name.includes(String(kw).toLowerCase()));
      if (hit) {
        matchedSupplierId = supplier.id;
        break;
      }
    }

    if (!matchedSupplierId) {
      unmatched.push(item);
      continue;
    }

    const bucket = dispatches.get(matchedSupplierId) ?? [];
    bucket.push(item);
    dispatches.set(matchedSupplierId, bucket);
  }

  for (const [supplierId, supplierItems] of dispatches.entries()) {
    // Persist supplier assignment to items so the public portal can render per-supplier lines.
    await pool.query(
      `
      UPDATE procurement_items
      SET supplier_id = $2::uuid
      WHERE order_id = $1::uuid AND id = ANY($3::uuid[])
      `,
      [orderId, supplierId, supplierItems.map((it) => it.id)]
    );

    const { rows } = await pool.query<{ id: string; access_token: string; token_expires_at: string }>(
      `
      INSERT INTO order_dispatches (order_id, supplier_id, organization_id)
      VALUES ($1::uuid, $2::uuid, $3::uuid)
      RETURNING id, access_token, token_expires_at
      `,
      [orderId, supplierId, orgId]
    );
    const dispatch = rows[0]!;
    logger.info(
      { orderId, supplierId, dispatchId: dispatch.id, items: supplierItems.length },
      'dispatchOrder: created dispatch'
    );

    const supplier = suppliers.find((s) => s.id === supplierId);
    const linkBase = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const orderLink = `${linkBase}/order/${dispatch.access_token}`;

    if (supplier?.email && (supplier.notify_channel === 'email' || supplier.notify_channel === 'both')) {
      await sendSupplierOrderEmail({
        to: supplier.email,
        contactName: supplier.contact_name ?? supplier.name,
        restaurantName,
        items: supplierItems.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
        })),
        orderLink,
        expiresAt: dispatch.token_expires_at,
      });
    }

    if (
      supplier?.telegram_chat_id &&
      (supplier.notify_channel === 'telegram' || supplier.notify_channel === 'both')
    ) {
      const lines = supplierItems
        .map((i) => `- ${i.product_name}: ${i.quantity}${i.unit ? ` ${i.unit}` : ''}`)
        .join('\n');
      await sendTelegramRaw(
        String(supplier.telegram_chat_id),
        `Новый заказ от ${restaurantName}\n\n${lines}\n\nОткрыть: ${orderLink}`
      );
    }
  }

  if (unmatched.length > 0) {
    logger.warn(
      { orderId, orgId, unmatched: unmatched.map((i) => i.product_name) },
      'dispatchOrder: unmatched items'
    );
  }
}

