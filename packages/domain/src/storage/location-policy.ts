import { z } from 'zod';
import { inventoryUnitStatusSchema } from './inventory-unit';

export const locationPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  locationId: z.string().uuid(),
  receivingEnabled: z.boolean(),
  allowMixedSkus: z.boolean(),
  defaultInventoryStatus: inventoryUnitStatusSchema,
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const skuLocationPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  minQtyEach: z.number().int().positive().nullable(),
  maxQtyEach: z.number().int().positive().nullable(),
  preferredPackagingProfileId: z.string().uuid().nullable(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type LocationPolicy = z.infer<typeof locationPolicySchema>;
export type SkuLocationPolicy = z.infer<typeof skuLocationPolicySchema>;
