import { z } from 'zod';

export const productPackagingLevelSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  baseUnitQty: z.number().int().min(1),
  isBase: z.boolean(),
  canPick: z.boolean(),
  canStore: z.boolean(),
  isDefaultPickUom: z.boolean(),
  barcode: z.string().trim().min(1).nullable(),
  packWeightG: z.number().int().positive().nullable(),
  packWidthMm: z.number().int().positive().nullable(),
  packHeightMm: z.number().int().positive().nullable(),
  packDepthMm: z.number().int().positive().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ProductPackagingLevel = z.infer<typeof productPackagingLevelSchema>;
