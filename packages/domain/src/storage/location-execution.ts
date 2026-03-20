import { z } from 'zod';

export const moveContainerToLocationBodySchema = z.object({
  targetLocationId: z.string().uuid()
});

export const canonicalMoveContainerResultSchema = z.object({
  containerId: z.string().uuid(),
  sourceLocationId: z.string().uuid().nullable(),
  targetLocationId: z.string().uuid(),
  movementId: z.string().uuid(),
  occurredAt: z.string()
});

export const transferInventoryUnitBodySchema = z.object({
  targetContainerId: z.string().uuid(),
  quantity: z.number().positive()
});

export const pickPartialInventoryUnitBodySchema = z.object({
  pickContainerId: z.string().uuid(),
  quantity: z.number().positive()
});

export const canonicalTransferInventoryResultSchema = z.object({
  sourceInventoryUnitId: z.string().uuid(),
  targetInventoryUnitId: z.string().uuid(),
  sourceContainerId: z.string().uuid(),
  targetContainerId: z.string().uuid(),
  sourceLocationId: z.string().uuid().nullable(),
  targetLocationId: z.string().uuid().nullable(),
  quantity: z.number().positive(),
  uom: z.string().trim().min(1),
  mergeApplied: z.boolean(),
  sourceQuantity: z.number().min(0),
  targetQuantity: z.number().min(0),
  movementId: z.string().uuid(),
  splitMovementId: z.string().uuid(),
  transferMovementId: z.string().uuid(),
  occurredAt: z.string()
});

export type MoveContainerToLocationBody = z.infer<typeof moveContainerToLocationBodySchema>;
export type CanonicalMoveContainerResult = z.infer<typeof canonicalMoveContainerResultSchema>;
export type TransferInventoryUnitBody = z.infer<typeof transferInventoryUnitBodySchema>;
export type PickPartialInventoryUnitBody = z.infer<typeof pickPartialInventoryUnitBodySchema>;
export type CanonicalTransferInventoryResult = z.infer<typeof canonicalTransferInventoryResultSchema>;
