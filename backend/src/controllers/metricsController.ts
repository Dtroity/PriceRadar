import type { Request, Response } from 'express';
import { uploadQueue, documentQueue } from '../workers/queue.js';

type QueueWithCounts = { getJobCounts(): Promise<{ waiting?: number; active?: number }> };

export async function prometheus(_req: Request, res: Response) {
  try {
    const [uploadCounts, docCounts] = await Promise.all([
      (uploadQueue as unknown as QueueWithCounts).getJobCounts(),
      (documentQueue as unknown as QueueWithCounts).getJobCounts(),
    ]);
    const lines = [
      '# HELP procureai_queue_waiting Number of jobs waiting in queue',
      '# TYPE procureai_queue_waiting gauge',
      `procureai_queue_waiting{queue="upload"} ${uploadCounts.waiting ?? 0}`,
      `procureai_queue_waiting{queue="documents"} ${docCounts.waiting ?? 0}`,
      '# HELP procureai_queue_active Number of jobs currently processing',
      '# TYPE procureai_queue_active gauge',
      `procureai_queue_active{queue="upload"} ${uploadCounts.active ?? 0}`,
      `procureai_queue_active{queue="documents"} ${docCounts.active ?? 0}`,
    ];
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).send('# Error fetching metrics');
  }
}
