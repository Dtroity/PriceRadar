/// <reference path="../../src/types/global.d.ts" />
import type { Job } from 'bullmq';
import type { SourceType } from '../types/index.js';
export interface UploadJobPayload {
    filePath: string;
    supplierName: string;
    sourceType: SourceType;
    mimeType: string;
    originalName: string;
    organizationId?: string;
    ingestionJobId?: string;
}
export declare function processUploadJob(job: Job<UploadJobPayload>): Promise<void>;
