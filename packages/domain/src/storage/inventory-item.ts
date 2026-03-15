import { z } from 'zod';
import { productSchema } from '../catalog/product';

export const inventoryItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  itemRef: z.string().trim().min(1),
  product: productSchema.nullable(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
