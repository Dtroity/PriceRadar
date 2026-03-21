import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};
import { generateRecommendations } from '../services/recommendationEngine.js';
import { pool } from '../db/pool.js';
import { logger } from '../utils/logger.js';

/** Sentinel for repeatable job: process all organizations. */
export const RECOMMENDATIONS_ALL_ORGS = '__all_orgs__';

export const recommendationsQueue = new Queue<{ organizationId: string }>('recommendations-engine', {
  connection,
});

export async function enqueueRecommendationsForOrg(organizationId: string): Promise<void> {
  await recommendationsQueue.add('generate', { organizationId }, { removeOnComplete: 100 });
}

export async function enqueueRecommendationsForAllOrgs(): Promise<void> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM organizations');
  for (const r of rows) {
    await enqueueRecommendationsForOrg(r.id).catch(() => {});
  }
}

export function startRecommendationsWorker(): void {
  new Worker<{ organizationId: string }>(
    'recommendations-engine',
    async (job) => {
      const orgId = job.data.organizationId;
      if (orgId === RECOMMENDATIONS_ALL_ORGS) {
        const { rows } = await pool.query<{ id: string }>('SELECT id FROM organizations');
        let total = 0;
        for (const r of rows) {
          total += await generateRecommendations(r.id);
        }
        logger.info({ jobId: job.id, orgs: rows.length, created: total }, 'recommendations all-orgs done');
        return;
      }
      const n = await generateRecommendations(orgId);
      logger.info({ jobId: job.id, organizationId: orgId, created: n }, 'recommendations job done');
    },
    { connection, concurrency: 2 }
  ).on('failed', (j, err) => logger.error({ err, jobId: j?.id }, 'recommendations worker failed'));
}
