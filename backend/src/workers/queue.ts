import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { processUploadJob, type UploadJobPayload } from './uploadProcessor.js';
import { processDocumentJob, type DocumentJobPayload } from './documentProcessor.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const uploadQueue = new Queue<UploadJobPayload>('upload', { connection });
export const documentQueue = new Queue<DocumentJobPayload>('documents', { connection });

let uploadWorker: Worker<UploadJobPayload> | null = null;
let documentWorker: Worker<DocumentJobPayload> | null = null;

export function startWorkers() {
  uploadWorker = new Worker<UploadJobPayload>(
    'upload',
    async (job) => processUploadJob(job),
    { connection, concurrency: 2 }
  );
  uploadWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Upload job failed');
  });
  uploadWorker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'Upload job completed');
  });
  uploadWorker.on('error', (err) => {
    logger.error({ err }, 'Upload worker error');
  });

  documentWorker = new Worker<DocumentJobPayload>(
    'documents',
    async (job) => processDocumentJob(job),
    { connection, concurrency: 2 }
  );
  documentWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Document job failed');
  });
  documentWorker.on('completed', (job) => {
    logger.info({ jobId: job?.id }, 'Document job completed');
  });
  documentWorker.on('error', (err) => {
    logger.error({ err }, 'Document worker error');
  });

  return uploadWorker;
}

export function stopWorkers() {
  if (uploadWorker) uploadWorker.close();
  if (documentWorker) documentWorker.close();
}
