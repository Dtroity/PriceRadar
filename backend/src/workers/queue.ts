import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
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
    console.error('Upload job failed:', job?.id, err);
  });

  documentWorker = new Worker<DocumentJobPayload>(
    'documents',
    async (job) => processDocumentJob(job),
    { connection, concurrency: 2 }
  );
  documentWorker.on('failed', (job, err) => {
    console.error('Document job failed:', job?.id, err);
  });

  return uploadWorker;
}

export function stopWorkers() {
  if (uploadWorker) uploadWorker.close();
  if (documentWorker) documentWorker.close();
}
