import { z } from 'zod';
import { inventoryPackagingStateSchema, inventoryUnitStatusSchema } from './inventory-unit';

export const containerLineKindSchema = z.enum(['receipt', 'current_fragment']);

export const containerLineSchema = z.object({
  id: z.string().uuid(),
  lineKind: containerLineKindSchema.default('receipt'),
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  productId: z.string().uuid(),
  qtyEach: z.number().positive(),
  lotCode: z.string().trim().min(1).nullable(),
  expiryDate: z.string().nullable(),
  serialNo: z.string().trim().min(1).nullable(),
  packagingProfileIdAtReceipt: z.string().uuid().nullable(),
  packagingProfileLevelIdAtReceipt: z.string().uuid().nullable(),
  levelTypeAtReceipt: z.string().trim().min(1).nullable(),
  designQtyEachAtReceipt: z.number().int().positive().nullable(),
  containerTypeAtReceipt: z.string().trim().min(1).nullable(),
  isNonStandardPack: z.boolean(),
  inventoryStatus: inventoryUnitStatusSchema,
  packLevelSnapshotJsonb: z.unknown().nullable(),
  receiptCorrelationKey: z.string().trim().min(1).nullable(),
  currentContainerId: z.string().uuid().nullable().optional(),
  currentQtyEach: z.number().min(0).nullable().optional(),
  currentInventoryStatus: inventoryUnitStatusSchema.nullable().optional(),
  currentPackagingState: inventoryPackagingStateSchema.nullable().optional(),
  currentPackagingProfileLevelId: z.string().uuid().nullable().optional(),
  currentPackCount: z.number().int().positive().nullable().optional(),
  rootReceiptLineId: z.string().uuid().nullable().optional(),
  parentContainerLineId: z.string().uuid().nullable().optional(),
  currentUpdatedAt: z.string().nullable().optional(),
  currentUpdatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type ContainerLineKind = z.infer<typeof containerLineKindSchema>;
export type ContainerLine = z.infer<typeof containerLineSchema>;
