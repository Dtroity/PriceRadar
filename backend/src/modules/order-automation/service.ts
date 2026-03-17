import * as repo from './repository.js';
import { orderAutomationQueue } from './worker.js';
import type { SendOrderJobPayload } from './types.js';

export async function createDraftOrder(
  organizationId: string,
  supplierId: string,
  notes: string | null,
  userId: string | null,
  items: { product_id: string; quantity: number; price?: number | null }[]
) {
  return repo.createOrder(organizationId, supplierId, notes, userId, items);
}

/** Bulk text lines → group by supplier via keyword filters (AZbot create_orders_from_bulk_message) */
export async function createOrdersFromBulkText(
  organizationId: string,
  userId: string | null,
  messageText: string,
  defaultSupplierId?: string | null
): Promise<{ orderIds: string[]; unmatched: string[] }> {
  const lines = parseBulkLines(messageText);
  if (!lines.length) return { orderIds: [], unmatched: [] };

  const bySupplier = new Map<string, string[]>();
  const unmatched: string[] = [];
  for (const line of lines) {
    let sid = await repo.findSupplierByLine(organizationId, line);
    if (!sid && defaultSupplierId) sid = defaultSupplierId;
    if (!sid) {
      unmatched.push(line);
      continue;
    }
    if (!bySupplier.has(sid)) bySupplier.set(sid, []);
    bySupplier.get(sid)!.push(line);
  }

  const orderIds: string[] = [];
  for (const [supplierId, lineList] of bySupplier) {
    const notes = lineList.join('\n');
    const order = await repo.createOrder(organizationId, supplierId, notes, userId, []);
    orderIds.push(order.id);
  }
  return { orderIds, unmatched };
}

function parseBulkLines(messageText: string): string[] {
  if (!messageText?.trim()) return [];
  const normalized = messageText
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n');
  return normalized.split('\n').map((l) => l.trim()).filter(Boolean);
}

export async function queueSendOrder(payload: SendOrderJobPayload) {
  await repo.updateOrderStatus(payload.orderId, payload.organizationId, 'queued');
  await orderAutomationQueue.add('send-order', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
