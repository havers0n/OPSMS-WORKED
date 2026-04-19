import { z } from 'zod';

export const productUnitProfileSchema = z.object({
  productId: z.string().uuid(),
  unitWeightG: z.number().int().positive().nullable(),
  unitWidthMm: z.number().int().positive().nullable(),
  unitHeightMm: z.number().int().positive().nullable(),
  unitDepthMm: z.number().int().positive().nullable(),
  weightClass: z.enum(['light', 'medium', 'heavy', 'very_heavy']).nullable(),
  sizeClass: z.enum(['small', 'medium', 'large', 'oversized']).nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ProductUnitProfile = z.infer<typeof productUnitProfileSchema>;
