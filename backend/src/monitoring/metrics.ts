import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { pool } from '../db/pool.js';
import { uploadQueue, documentQueue } from '../workers/queue.js';

export const register = new Registry();
collectDefaultMetrics({ register, prefix: 'nodejs_' });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const documentsProcessedTotal = new Counter({
  name: 'documents_processed_total',
  help: 'Documents processed by worker',
  labelNames: ['status'],
  registers: [register],
});

export const documentsOcrConfidence = new Histogram({
  name: 'documents_ocr_confidence',
  help: 'OCR confidence distribution',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1],
  registers: [register],
});

export const documentsQueueSize = new Gauge({
  name: 'documents_queue_size',
  help: 'BullMQ document queue waiting + active jobs',
  registers: [register],
});

export const anomaliesDetectedTotal = new Counter({
  name: 'anomalies_detected_total',
  help: 'Price anomalies recorded',
  labelNames: ['severity'],
  registers: [register],
});

export const dbPoolActive = new Gauge({
  name: 'db_pool_active',
  help: 'pg pool active (checked-out) clients',
  registers: [register],
});

export const dbPoolIdle = new Gauge({
  name: 'db_pool_idle',
  help: 'pg pool idle clients',
  registers: [register],
});

type QueueWithCounts = { getJobCounts(): Promise<Record<string, number>> };

async function refreshGauges(): Promise<void> {
  try {
    dbPoolActive.set(pool.totalCount - pool.idleCount);
    dbPoolIdle.set(pool.idleCount);
  } catch {
    /* ignore */
  }
  try {
    const [uploadCounts, docCounts] = await Promise.all([
      (uploadQueue as unknown as QueueWithCounts).getJobCounts(),
      (documentQueue as unknown as QueueWithCounts).getJobCounts(),
    ]);
    const waiting = (docCounts.waiting ?? 0) + (docCounts.active ?? 0);
    documentsQueueSize.set(waiting);
  } catch {
    /* ignore */
  }
}

export async function renderMetrics(): Promise<string> {
  await refreshGauges();
  return register.metrics();
}

export function getRegisterContentType(): string {
  return register.contentType;
}
