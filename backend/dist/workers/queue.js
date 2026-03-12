import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { processUploadJob } from './uploadProcessor.js';
const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
};
export const uploadQueue = new Queue('upload', { connection });
let uploadWorker = null;
export function startWorkers() {
    uploadWorker = new Worker('upload', async (job) => processUploadJob(job), { connection, concurrency: 2 });
    uploadWorker.on('failed', (job, err) => {
        console.error('Upload job failed:', job?.id, err);
    });
    return uploadWorker;
}
export function stopWorkers() {
    if (uploadWorker)
        return uploadWorker.close();
}
