import { z } from 'zod';

export const inventoryUnitStatusSchema = z.enum(['available', 'reserved', 'damaged', 'hold']);

export const inventoryUnitSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1),
  lotCode: z.string().trim().min(1).nullable(),
  serialNo: z.string().trim().min(1).nullable(),
  expiryDate: z.string().nullable(),
  status: inventoryUnitStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type InventoryUnitStatus = z.infer<typeof inventoryUnitStatusSchema>;
export type InventoryUnit = z.infer<typeof inventoryUnitSchema>;
