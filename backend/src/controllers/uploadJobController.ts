import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import type { UploadJobPayload } from '../workers/uploadProcessor.js';
import { uploadQueue } from '../workers/queue.js';

/** bullmq Job at runtime; typings are incomplete under NodeNext moduleResolution. */
type UploadJobHandle = {
  data: UploadJobPayload;
  getState: () => Promise<string>;
  failedReason?: string;
  stacktrace?: string[];
  attemptsMade?: number;
};

export async function getJobStatus(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const jobId = req.params.jobId;
    const q = uploadQueue as unknown as { getJob: (id: string) => Promise<UploadJobHandle | undefined> };
    const job = await q.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.data.organizationId !== organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const state = await job.getState();
    const failedReason =
      state === 'failed' ? job.failedReason || (job.stacktrace?.[0] ?? 'Unknown error') : undefined;
    return res.json({
      state,
      failedReason,
      attemptsMade: job.attemptsMade,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
}
