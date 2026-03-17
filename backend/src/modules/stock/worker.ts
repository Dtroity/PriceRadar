import { Queue, Worker } from 'bullmq';
import { config } from '../../config.js';
import * as repo from './repository.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export interface StockUpdatePayload {
  organizationId: string;
  documentId: string;
}


export const stockUpdateQueue = new Queue<StockUpdatePayload>('stock-update', { connection });

let worker: Worker<StockUpdatePayload> | null = null;

export function startStockUpdateWorker() {
  if (worker) return worker;
  worker = new Worker<StockUpdatePayload>(
    'stock-update',
    async (job) => {
      const { documentId, organizationId } = job.data;
      const { applyInvoice } = await import('./service.js');
      await applyInvoice(documentId, organizationId);
    },
    { connection, concurrency: 4 }
  );
  worker.on('failed', (j, err) => console.error('stock-update failed', j?.id, err));
  return worker;
}

export function stopStockUpdateWorker() {
  worker?.close();
  worker = null;
}
