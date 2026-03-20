import type { Job } from 'bullmq';
import type { SourceType } from '../types/index.js';
export interface UploadJobPayload {
    filePath: string;
    supplierName: string;
    sourceType: SourceType;
    mimeType: string;
    originalName: string;
    organizationId?: string;
}
export declare function processUploadJob(job: Job<UploadJobPayload>): Promise<void>;
