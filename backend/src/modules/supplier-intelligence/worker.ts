import { Queue, Worker } from 'bullmq';
import { config } from '../../config.js';
import { pool } from '../../db/pool.js';
import * as repo from './repository.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const supplierScoringQueue = new Queue<{ organizationId: string }>('supplier-scoring', { connection });

export interface SupplierScoringPayload {
  organizationId: string;
}

let worker: Worker<SupplierScoringPayload> | null = null;

export function startSupplierIntelligenceWorker() {
  if (worker) return worker;
  worker = new Worker<SupplierScoringPayload>(
    'supplier-scoring',
    async (job) => {
      let organizationIds: string[] = [job.data.organizationId];
      if (!job.data.organizationId) {
        const { rows } = await pool.query('SELECT id FROM organizations');
        organizationIds = rows.map((r: { id: string }) => r.id);
      }
      for (const organizationId of organizationIds) {
        if (!organizationId) continue;
        const stats = await repo.getSupplierPriceStats(organizationId);
      const productCounts = await repo.getSupplierProductCount(organizationId);
      const maxProducts = Math.max(...productCounts.map((r: { product_count: string }) => Number(r.product_count)), 1);

      const bySupplier = new Map<string, { prices: number[]; stddevs: number[] }>();
      for (const r of stats) {
        const sid = r.supplier_id;
        if (!bySupplier.has(sid)) bySupplier.set(sid, { prices: [], stddevs: [] });
        const entry = bySupplier.get(sid)!;
        entry.prices.push(Number(r.avg_price));
        entry.stddevs.push(Number(r.price_stddev) || 0);
      }

      const supplierList = await pool.query(
        `SELECT id FROM suppliers WHERE organization_id = $1`,
        [organizationId]
      );

      for (const s of supplierList.rows) {
        const sid = s.id;
        const entry = bySupplier.get(sid) || { prices: [], stddevs: [] };
        const avgPrice = entry.prices.length ? entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length : 0;
        const avgVolatility = entry.stddevs.length ? entry.stddevs.reduce((a, b) => a + b, 0) / entry.stddevs.length : 0;
        const pc = productCounts.find((c: { supplier_id: string }) => c.supplier_id === sid);
        const productCount = pc ? Number(pc.product_count) : 0;
        const availabilityScore = Math.min(100, (productCount / maxProducts) * 100);

        const allAvgPrices = [...bySupplier.values()].flatMap((e) => e.prices);
        const globalAvg = allAvgPrices.length ? allAvgPrices.reduce((a, b) => a + b, 0) / allAvgPrices.length : avgPrice;
        const priceScore = globalAvg > 0 ? Math.max(0, Math.min(100, 100 - ((avgPrice - globalAvg) / globalAvg) * 50)) : 50;

        const allVolatilities = [...bySupplier.values()].flatMap((e) => e.stddevs);
        const avgVolGlobal = allVolatilities.length ? allVolatilities.reduce((a, b) => a + b, 0) / allVolatilities.length : 0;
        const stabilityScore = avgVolGlobal > 0 ? Math.max(0, Math.min(100, 100 - (avgVolatility / avgVolGlobal) * 30)) : 100;

        const totalScore = (priceScore * 0.4 + stabilityScore * 0.3 + availabilityScore * 0.3);
        await repo.upsertSupplierScore(sid, organizationId, priceScore, stabilityScore, availabilityScore, totalScore);
      }
      }
    },
    { connection, concurrency: 2 }
  );
  worker.on('failed', (j, err) => console.error('supplier-scoring failed', j?.id, err));
  return worker;
}

export function stopSupplierIntelligenceWorker() {
  worker?.close();
  worker = null;
}
