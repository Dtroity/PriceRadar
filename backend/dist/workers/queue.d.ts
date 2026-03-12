import { Queue, Worker } from 'bullmq';
import { type UploadJobPayload } from './uploadProcessor.js';
export declare const uploadQueue: Queue<UploadJobPayload>;
export declare function startWorkers(): Worker<UploadJobPayload>;
export declare function stopWorkers(): Promise<void> | undefined;
