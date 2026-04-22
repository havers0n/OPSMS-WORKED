import { z } from 'zod';

export const packagingProfileLevelSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  levelType: z.string().trim().min(1),
  qtyEach: z.number().int().positive(),
  parentLevelType: z.string().trim().min(1).nullable(),
  qtyPerParent: z.number().int().positive().nullable(),
  containerType: z.string().trim().min(1).nullable(),
  tareWeightG: z.number().int().positive().nullable(),
  nominalGrossWeightG: z.number().int().positive().nullable(),
  lengthMm: z.number().int().positive().nullable(),
  widthMm: z.number().int().positive().nullable(),
  heightMm: z.number().int().positive().nullable(),
  casesPerTier: z.number().int().positive().nullable(),
  tiersPerPallet: z.number().int().positive().nullable(),
  maxStackHeight: z.number().int().positive().nullable(),
  maxStackWeight: z.number().int().positive().nullable(),
  legacyProductPackagingLevelId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type PackagingProfileLevel = z.infer<typeof packagingProfileLevelSchema>;
