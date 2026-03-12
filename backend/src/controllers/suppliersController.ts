import type { Response } from 'express';
import * as suppliersModel from '../models/suppliers.js';

export async function list(_req: unknown, res: Response) {
  try {
    const suppliers = await suppliersModel.getAllSuppliers();
    return res.json({ suppliers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
}
