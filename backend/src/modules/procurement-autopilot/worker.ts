import { Queue, Worker } from 'bullmq';
import { config } from '../../config.js';
import * as autopilotRepo from './repository.js';
import * as stockRepo from '../stock/repository.js';
import * as orderRepo from '../order-automation/repository.js';
import * as supplierIntelligence from '../supplier-intelligence/service.js';
import { notifyAutopilotOrder } from '../../services/telegramNotify.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const procurementAutopilotQueue = new Queue<{ organizationId?: string }>('procurement-autopilot', { connection });

let worker: Worker<{ organizationId?: string }> | null = null;

export function startProcurementAutopilotWorker() {
  if (worker) return worker;
  worker = new Worker<{ organizationId?: string }>(
    'procurement-autopilot',
    async (job) => {
      let orgIds: string[] = [];
      if (job.data.organizationId) {
        orgIds = [job.data.organizationId];
      } else {
        const orgs = await autopilotRepo.getAllOrganizationsWithAutopilot();
        orgIds = orgs.map((r: { organization_id: string }) => r.organization_id);
      }
      for (const organizationId of orgIds) {
        const settings = await autopilotRepo.getOrganizationSettings(organizationId);
        if (settings.autopilot_mode === 'disabled') continue;
        const threshold = settings.autopilot_days_threshold ?? 3;
        const stockRows = await stockRepo.listStock(organizationId);
        const toOrder: Array<{ product_id: string; product_name: string; quantity: number; days_remaining: number }> = [];
        for (const row of stockRows) {
          const daily = await stockRepo.getConsumptionFromRecipeUsage(organizationId, row.product_id, 14);
          const stock = Number(row.current_stock);
          const daysRemaining = daily > 0 ? stock / daily : 999;
          if (daysRemaining < threshold && daily > 0) {
            const orderQty = Math.ceil(threshold * daily - stock);
            if (orderQty > 0) toOrder.push({ product_id: row.product_id, product_name: row.product_name, quantity: orderQty, days_remaining: daysRemaining });
          }
        }
        if (toOrder.length === 0) continue;
        const { notifyLowStock } = await import('../../services/telegramNotify.js');
        if (toOrder.length > 0 && settings.autopilot_mode === 'recommend_only') {
          const first = toOrder[0];
          const rec = await supplierIntelligence.getRecommendations(organizationId, first.product_id);
          await notifyLowStock(
            organizationId,
            first.product_name,
            first.days_remaining,
            first.quantity,
            rec.best_supplier?.supplier_name ?? '—',
            rec.expected_savings
          ).catch(() => {});
        }
        const bySupplier = new Map<string, Array<{ product_id: string; quantity: number; price?: number }>>();
        for (const item of toOrder) {
          const rec = await supplierIntelligence.getRecommendations(organizationId, item.product_id);
          const supplierId = rec.best_supplier?.supplier_id;
          if (!supplierId) continue;
          if (!bySupplier.has(supplierId)) bySupplier.set(supplierId, []);
          bySupplier.get(supplierId)!.push({
            product_id: item.product_id,
            quantity: item.quantity,
            price: rec.best_supplier?.price,
          });
        }
        for (const [supplierId, items] of bySupplier) {
          if (items.length === 0) continue;
          if (settings.autopilot_mode === 'recommend_only') continue;
          const order = await orderRepo.createOrder(organizationId, supplierId, 'Autopilot: low stock', null, items, true);
          if (order) {
            await notifyAutopilotOrder(organizationId, order.id, items.length).catch(() => {});
          }
          if (settings.autopilot_mode === 'auto_send' && order) {
            const { orderAutomationQueue } = await import('../order-automation/worker.js');
            await orderAutomationQueue.add('send-order', {
              orderId: order.id,
              organizationId,
              channels: ['email', 'telegram', 'api_endpoint'],
            }).catch(() => {});
          }
        }
      }
    },
    { connection, concurrency: 1 }
  );
  worker.on('failed', (j, err) => console.error('procurement-autopilot failed', j?.id, err));
  return worker;
}

export function stopProcurementAutopilotWorker() {
  worker?.close();
  worker = null;
}
