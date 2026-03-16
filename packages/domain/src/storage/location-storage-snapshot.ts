import { z } from 'zod';
import { containerStatusSchema } from './container';
import { locationTypeSchema } from './location';
import { productSchema } from '../catalog/product';

export const locationStorageSnapshotRowSchema = z.object({
  tenantId: z.string().uuid(),
  floorId: z.string().uuid(),
  locationId: z.string().uuid(),
  locationCode: z.string().trim().min(1),
  locationType: locationTypeSchema,
  cellId: z.string().uuid().nullable(),
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

export type LocationStorageSnapshotRow = z.infer<typeof locationStorageSnapshotRowSchema>;
