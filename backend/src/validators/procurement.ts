import { z } from 'zod';

const orderItem = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().max(20).optional(),
  target_price: z.number().positive().optional(),
  supplier_id: z.string().uuid().optional(),
});

/** Создание заявки: нужен хотя бы заголовок, поставщик, заметки или позиции */
export const CreateOrderSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    supplier_id: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
    items: z.array(orderItem).optional(),
  })
  .strict()
  .refine(
    (d) =>
      (d.title != null && d.title.trim() !== '') ||
      d.supplier_id != null ||
      (d.notes != null && d.notes.trim() !== '') ||
      (Array.isArray(d.items) && d.items.length > 0),
    { message: 'Укажите title, supplier_id, notes или items' }
  );

export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled']),
  })
  .strict();

export const AddItemSchema = z
  .object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit: z.string().max(20).optional(),
    target_price: z.number().positive().optional(),
    supplier_id: z.string().uuid().optional(),
  })
  .strict();

export const PatchItemSchema = z
  .object({
    quantity: z.number().positive().optional(),
    actual_price: z.number().nonnegative().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const PatchOrderHeaderSchema = z
  .object({
    title: z.string().max(255).nullable().optional(),
    supplier_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();
