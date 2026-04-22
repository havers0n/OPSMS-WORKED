import { z } from 'zod';

export const packagingProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  profileType: z.enum(['legacy_bridge', 'receiving']),
  scopeType: z.enum(['tenant', 'location']),
  scopeId: z.string().uuid(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  priority: z.number().int(),
  isDefault: z.boolean(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type PackagingProfile = z.infer<typeof packagingProfileSchema>;
