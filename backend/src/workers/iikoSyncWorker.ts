import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { syncIikoNomenclature } from '../services/iikoSync.js';
import { logger } from '../utils/logger.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const IIKO_SYNC_ALL = '__all_orgs__';

export const iikoSyncQueue = new Queue<{ organizationId: string }>('iiko-sync', { connection });

export async function enqueueIikoSyncAllOrgs(): Promise<void> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM organizations WHERE iiko_api_url IS NOT NULL AND TRIM(iiko_api_url) <> ''`
  );
  for (const r of rows) {
    await iikoSyncQueue.add('sync', { organizationId: r.id }, { removeOnComplete: 50 }).catch(() => {});
  }
}

export function startIikoSyncWorker(): void {
  new Worker<{ organizationId: string }>(
    'iiko-sync',
    async (job) => {
      const orgId = job.data.organizationId;
      if (orgId === IIKO_SYNC_ALL) {
        await enqueueIikoSyncAllOrgs();
        return;
      }
      await syncIikoNomenclature(orgId);
    },
    { connection, concurrency: 1 }
  ).on('failed', (j, err) => logger.error({ err, jobId: j?.id }, 'iiko sync job failed'));
}
