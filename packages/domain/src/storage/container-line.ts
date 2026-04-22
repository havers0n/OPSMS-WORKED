import { z } from 'zod';
import { inventoryUnitStatusSchema } from './inventory-unit';

export const containerLineSchema = z.object({
  id: z.string().uuid(),
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
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type ContainerLine = z.infer<typeof containerLineSchema>;
