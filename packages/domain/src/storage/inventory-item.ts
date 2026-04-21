import { z } from 'zod';
import { productSchema } from '../catalog/product';
import { inventoryPackagingStateSchema } from './inventory-unit';

/**
 * Compatibility DTO for current public inventory APIs.
 * Canonical execution stock is represented by InventoryUnit.
 */
export const inventoryItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  itemRef: z.string().trim().min(1),
  product: productSchema.nullable(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1),
  packagingState: inventoryPackagingStateSchema.nullable().optional(),
  productPackagingLevelId: z.string().uuid().nullable().optional(),
  packCount: z.number().int().positive().nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
