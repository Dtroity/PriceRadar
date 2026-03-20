import { Queue, Worker } from 'bullmq';
import { type UploadJobPayload } from './uploadProcessor.js';
import { type DocumentJobPayload } from './documentProcessor.js';
export declare const uploadQueue: Queue<UploadJobPayload>;
export declare const documentQueue: Queue<DocumentJobPayload>;
export declare function startWorkers(): Worker<UploadJobPayload>;
export declare function stopWorkers(): void;
