import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { DUPLICATE_SIMILARITY_AUTO } from '../config/constants.js';
import { runAutoMergeDuplicates } from '../services/duplicateDetector.js';
import { logger } from '../utils/logger.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const duplicateScanQueue = new Queue('duplicate-scan', { connection });

let duplicateWorker: Worker | null = null;

export function startDuplicateScanWorker(): void {
  duplicateWorker = new Worker(
    'duplicate-scan',
    async () => {
      const { rows } = await pool.query<{ id: string }>('SELECT id FROM organizations');
      let total = 0;
      for (const r of rows) {
        const n = await runAutoMergeDuplicates(r.id, DUPLICATE_SIMILARITY_AUTO, null);
        total += n;
        if (n > 0) {
          logger.info({ organizationId: r.id, merged: n, msg: 'duplicate-scan merged' });
        }
      }
      logger.info({ totalMerged: total, msg: 'duplicate-scan batch complete' });
    },
    { connection, concurrency: 1 }
  );
  duplicateWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'duplicate-scan job failed');
  });
}
