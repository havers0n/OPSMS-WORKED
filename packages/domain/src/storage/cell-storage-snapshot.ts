import { z } from 'zod';
import { containerStatusSchema } from './container';
import { productSchema } from '../catalog/product';

export const cellStorageSnapshotRowSchema = z.object({
  tenantId: z.string().uuid(),
  cellId: z.string().uuid(),
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  placedAt: z.string(),
  itemRef: z.string().trim().min(1).nullable(),
  product: productSchema.nullable(),
  quantity: z.number().min(0).nullable(),
  uom: z.string().trim().min(1).nullable()
});

export type CellStorageSnapshotRow = z.infer<typeof cellStorageSnapshotRowSchema>;
