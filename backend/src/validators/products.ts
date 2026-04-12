import { z } from 'zod';

/** POST /products/merge */
export const MergeProductsSchema = z
  .object({
    sourceProductIds: z.array(z.string().uuid()).min(1),
    targetProductId: z.string().uuid(),
  })
  .strict();

/** POST /products/normalize */
export const NormalizeProductsSchema = z
  .object({
    rawNames: z.array(z.string().min(1)).min(1),
    targetNormalizedName: z.string().min(1),
  })
  .strict();

/** PATCH /products/:id/favorite */
export const FavoriteProductSchema = z.object({ isFavorite: z.boolean() }).strict();
