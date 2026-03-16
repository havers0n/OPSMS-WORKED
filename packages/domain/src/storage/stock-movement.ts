import { z } from 'zod';

export const stockMovementTypeSchema = z.enum([
  'receive',
  'putaway',
  'move_container',
  'split_stock',
  'transfer_stock',
  'pick_partial',
  'ship',
  'adjust'
]);

export const stockMovementStatusSchema = z.enum(['pending', 'done', 'cancelled']);

export const stockMovementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  movementType: stockMovementTypeSchema,
  sourceLocationId: z.string().uuid().nullable(),
  targetLocationId: z.string().uuid().nullable(),
  sourceContainerId: z.string().uuid().nullable(),
  targetContainerId: z.string().uuid().nullable(),
  sourceInventoryUnitId: z.string().uuid().nullable(),
  targetInventoryUnitId: z.string().uuid().nullable(),
  quantity: z.number().min(0).nullable(),
  uom: z.string().trim().min(1).nullable(),
  status: stockMovementStatusSchema,
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  createdBy: z.string().uuid().nullable()
});

export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type StockMovementStatus = z.infer<typeof stockMovementStatusSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
