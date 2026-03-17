import { Queue, Worker } from 'bullmq';
import { config } from '../../config.js';
import * as repo from './repository.js';
import type { SendOrderJobPayload } from './types.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const orderAutomationQueue = new Queue<SendOrderJobPayload>('order-automation', { connection });

let worker: Worker<SendOrderJobPayload> | null = null;

export function startOrderAutomationWorker() {
  if (worker) return worker;
  worker = new Worker<SendOrderJobPayload>(
    'order-automation',
    async (job) => {
      const { orderId, organizationId, channels } = job.data;
      const order = await repo.getOrder(orderId, organizationId);
      if (!order) throw new Error('Order not found');
      const contacts = await repo.listContacts(order.supplier_id);
      const items = await repo.getOrderItems(orderId);
      const body = formatOrderBody(order, items);

      for (const ch of channels) {
        const c = contacts.find((x) => x.type === ch);
        if (!c) continue;
        if (ch === 'email') await sendEmailPlaceholder(c.value, body);
        if (ch === 'telegram') await sendTelegramPlaceholder(c.value, body);
        if (ch === 'whatsapp') await sendWhatsAppPlaceholder(c.value, body);
        if (ch === 'api_endpoint') await postApiPlaceholder(c.value, { orderId, body });
      }
      await repo.updateOrderStatus(orderId, organizationId, 'sent', new Date());
    },
    { connection, concurrency: 10 }
  );
  worker.on('failed', (j, err) => console.error('order-automation job failed', j?.id, err));
  return worker;
}

function formatOrderBody(
  order: { notes: string | null },
  items: { product_id: string; quantity: number; price: number | null }[]
): string {
  const lines = items.length
    ? items.map((i) => `${i.product_id} x ${i.quantity} @ ${i.price ?? '—'}`).join('\n')
    : order.notes || '';
  return `Order\n${lines}`;
}

async function sendEmailPlaceholder(to: string, body: string): Promise<void> {
  console.log('[order-automation] email →', to, body.slice(0, 200));
}

async function sendTelegramPlaceholder(chatRef: string, body: string): Promise<void> {
  console.log('[order-automation] telegram →', chatRef, body.slice(0, 200));
}

async function sendWhatsAppPlaceholder(phone: string, body: string): Promise<void> {
  console.log('[order-automation] whatsapp →', phone, body.slice(0, 200));
}

async function postApiPlaceholder(url: string, payload: unknown): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function stopOrderAutomationWorker() {
  worker?.close();
  worker = null;
}
