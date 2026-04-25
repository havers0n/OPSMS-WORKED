import { z } from 'zod';
import { containerStatusSchema } from './container';
import { locationTypeSchema } from './location';
import { productSchema } from '../catalog/product';
import { inventoryPackagingStateSchema } from './inventory-unit';
import { storagePresetMaterializationStatusSchema, storagePresetUsageStatusSchema } from '../catalog/storage-preset';

export const locationStorageSnapshotRowSchema = z.object({
  tenantId: z.string().uuid(),
  floorId: z.string().uuid(),
  locationId: z.string().uuid(),
  locationCode: z.string().trim().min(1),
  locationType: locationTypeSchema,
  cellId: z.string().uuid().nullable(),
  containerId: z.string().uuid(),
  systemCode: z.string().trim().min(1),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  placedAt: z.string(),
  inventoryUnitId: z.string().uuid().nullable().optional(),
  itemRef: z.string().trim().min(1).nullable(),
  product: productSchema.nullable(),
  quantity: z.number().min(0).nullable(),
  uom: z.string().trim().min(1).nullable(),
  packagingState: inventoryPackagingStateSchema.nullable().optional(),
  productPackagingLevelId: z.string().uuid().nullable().optional(),
  packCount: z.number().int().positive().nullable().optional(),
  containerPackagingProfileId: z.string().uuid().nullable().optional(),
  containerIsStandardPack: z.boolean().nullable().optional(),
  preferredPackagingProfileId: z.string().uuid().nullable().optional(),
  presetUsageStatus: storagePresetUsageStatusSchema.optional(),
  presetMaterializationStatus: storagePresetMaterializationStatusSchema.optional()
});

export const locationStorageSnapshotResponseSchema = z.array(locationStorageSnapshotRowSchema);

export type LocationStorageSnapshotRow = z.infer<typeof locationStorageSnapshotRowSchema>;
