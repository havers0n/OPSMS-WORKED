import { z } from 'zod';
import { packagingProfileLevelSchema } from './packaging-profile-level';
import { packagingProfileSchema } from './packaging-profile';

export const storagePresetUsageStatusSchema = z.enum([
  'preferred_match',
  'standard_non_preferred',
  'manual',
  'unknown'
]);

export const storagePresetMaterializationStatusSchema = z.enum([
  'shell',
  'materialized',
  'manual',
  'unknown'
]);

export const storagePresetSchema = packagingProfileSchema.extend({
  profileType: z.literal('storage'),
  levels: z.array(packagingProfileLevelSchema)
});

export const createStoragePresetLevelSchema = z.object({
  levelType: z.string().trim().min(1),
  qtyEach: z.number().int().positive(),
  parentLevelType: z.string().trim().min(1).nullable().optional(),
  qtyPerParent: z.number().int().positive().nullable().optional(),
  containerType: z.string().trim().min(1).nullable().optional(),
  legacyProductPackagingLevelId: z.string().uuid().nullable().optional()
});

export const createStoragePresetBodySchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  scopeType: z.enum(['tenant', 'location']).default('tenant'),
  scopeId: z.string().uuid().optional(),
  isDefault: z.boolean().optional().default(false),
  priority: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  levels: z.array(createStoragePresetLevelSchema).min(1)
});

export const patchStoragePresetBodySchema = createStoragePresetBodySchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
});

export const createContainerFromStoragePresetBodySchema = z.object({
  locationId: z.string().uuid().optional(),
  externalCode: z.string().trim().min(1).optional(),
  materializeContents: z.boolean().optional().default(false)
});

export const createContainerFromStoragePresetResultSchema = z.object({
  containerId: z.string().uuid(),
  systemCode: z.string().trim().min(1),
  externalCode: z.string().trim().min(1).nullable(),
  containerTypeId: z.string().uuid(),
  packagingProfileId: z.string().uuid(),
  isStandardPack: z.literal(true),
  placedLocationId: z.string().uuid().nullable(),
  materializationMode: z.enum(['shell', 'materialized']),
  materializationStatus: z.enum(['shell', 'materialized', 'partial_failed']).optional().default('shell'),
  materializationErrorCode: z.string().trim().min(1).nullable().optional().default(null),
  materializationErrorMessage: z.string().trim().min(1).nullable().optional().default(null),
  materializedInventoryUnitId: z.string().uuid().nullable(),
  materializedContainerLineId: z.string().uuid().nullable(),
  materializedQuantity: z.number().positive().nullable()
});

export const setPreferredStoragePresetBodySchema = z.object({
  preferredPackagingProfileId: z.string().uuid().nullable()
});

export type StoragePresetUsageStatus = z.infer<typeof storagePresetUsageStatusSchema>;
export type StoragePresetMaterializationStatus = z.infer<typeof storagePresetMaterializationStatusSchema>;
export type StoragePreset = z.infer<typeof storagePresetSchema>;
export type CreateStoragePresetBody = z.infer<typeof createStoragePresetBodySchema>;
export type PatchStoragePresetBody = z.infer<typeof patchStoragePresetBodySchema>;
export type CreateContainerFromStoragePresetResult = z.infer<typeof createContainerFromStoragePresetResultSchema>;
