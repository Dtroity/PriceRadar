import type { Request, Response } from 'express';
import { uploadQueue } from '../workers/queue.js';
import { config } from '../config.js';
export async function upload(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const supplierName = (req.body.supplierName as string)?.trim() || 'Unknown Supplier';
    const sourceType = (req.body.sourceType as string) || 'web';
    if (!['web', 'telegram', 'camera'].includes(sourceType)) {
      return res.status(400).json({ error: 'Invalid sourceType' });
    }

    const job = await uploadQueue.add(
      'process',
      {
        filePath: file.path,
        supplierName,
        sourceType: sourceType as 'web' | 'telegram' | 'camera',
        mimeType: file.mimetype,
        originalName: file.originalname,
      },
      { attempts: 2, backoff: { type: 'exponential', delay: 2000 } }
    );
    return res.status(202).json({
      message: 'Upload queued',
      jobId: job.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
