import type { Response } from 'express';
import type { AuthRequest } from '../auth/middleware.js';
import * as recipesModel from '../models/recipes.js';
import { consumeRecipe } from '../services/recipeUsageService.js';

export async function list(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const recipes = await recipesModel.listRecipes(organizationId);
    return res.json({ recipes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list recipes' });
  }
}

export async function consume(req: AuthRequest, res: Response) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const recipeId = req.params.id;
    const quantity = Number((req.body as { quantity?: number }).quantity ?? 1);
    if (quantity <= 0) return res.status(400).json({ error: 'quantity must be positive' });
    await consumeRecipe(recipeId, organizationId, quantity);
    return res.json({ message: 'Stock updated', quantity });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Consume failed' });
  }
}
