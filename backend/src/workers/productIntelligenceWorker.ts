import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { listOrganizationIds } from '../models/productMetrics.js';
import { recalculateAllScoresForOrganization } from '../domains/product-intelligence/productIntelligence.service.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const productIntelligenceQueue = new Queue<{ organizationId?: string }>('product-intelligence', {
  connection,
});

let worker: Worker | null = null;

export function startProductIntelligenceWorker() {
  worker = new Worker<{ organizationId?: string }>(
    'product-intelligence',
    async () => {
      // Queue is single-purpose (recalculate_product_scores); BullMQ Job typings omit `name` in some versions.
      const orgs = await listOrganizationIds();
      let total = 0;
      for (const organizationId of orgs) {
        try {
          const n = await recalculateAllScoresForOrganization(organizationId);
          total += n;
        } catch (err) {
          logger.error({ err, organizationId }, 'recalculate_product_scores org failed');
        }
      }
      logger.info({ totalProducts: total, orgCount: orgs.length }, 'recalculate_product_scores done');
    },
    { connection, concurrency: 1 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'product-intelligence job failed');
  });
  return worker;
}

export function stopProductIntelligenceWorker() {
  if (worker) void worker.close();
}
