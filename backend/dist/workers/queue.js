import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { processUploadJob } from './uploadProcessor.js';
import { processDocumentJob } from './documentProcessor.js';
const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
};
export const uploadQueue = new Queue('upload', { connection });
export const documentQueue = new Queue('documents', { connection });
let uploadWorker = null;
let documentWorker = null;
export function startWorkers() {
    uploadWorker = new Worker('upload', async (job) => processUploadJob(job), { connection, concurrency: 2 });
    uploadWorker.on('failed', (job, err) => {
        logger.error({ err, jobId: job?.id }, 'Upload job failed');
    });
    documentWorker = new Worker('documents', async (job) => processDocumentJob(job), { connection, concurrency: 2 });
    documentWorker.on('failed', (job, err) => {
        logger.error({ err, jobId: job?.id }, 'Document job failed');
    });
    return uploadWorker;
}
export function stopWorkers() {
    if (uploadWorker)
        uploadWorker.close();
    if (documentWorker)
        documentWorker.close();
}
