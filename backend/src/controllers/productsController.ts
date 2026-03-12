import type { Request, Response } from 'express';
import * as productsModel from '../models/products.js';

export async function list(_req: unknown, res: Response) {
  try {
    const products = await productsModel.getAllProducts();
    return res.json({ products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
}

export async function setPriority(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { isPriority } = req.body as { isPriority?: boolean };
    await productsModel.setProductPriority(id, Boolean(isPriority));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
}
