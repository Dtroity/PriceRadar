import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import { collectTrainingDataset, toJSONL } from '../modules/invoice-ai/trainingDatasetService.js';

export async function trainingDataset(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    const rows = await collectTrainingDataset(organizationId ?? undefined);
    const jsonl = toJSONL(rows);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', 'attachment; filename=training-dataset.jsonl');
    res.send(jsonl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate training dataset' });
  }
}
