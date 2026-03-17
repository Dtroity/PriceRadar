import type { Response } from 'express';
import * as suppliersModel from '../models/suppliers.js';
import * as suppliersMt from '../models/suppliers-mt.js';
import type { AuthRequest } from '../auth/middleware.js';
import { config } from '../config.js';

export async function list(req: unknown, res: Response) {
  try {
    const authReq = req as AuthRequest;
    if (config.multiTenant && authReq.user?.organizationId) {
      const suppliers = await suppliersMt.getAllByOrganization(authReq.user.organizationId);
      return res.json({ suppliers });
    }
    const suppliers = await suppliersModel.getAllSuppliers();
    return res.json({ suppliers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
}
