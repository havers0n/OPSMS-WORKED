import { z } from 'zod';

const productAssetListSchema = z.array(z.string().trim().min(1));

export const productSchema = z.object({
  id: z.string().uuid(),
  source: z.string().trim().min(1),
  externalProductId: z.string().trim().min(1),
  sku: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(1),
  permalink: z.string().trim().min(1).nullable(),
  imageUrls: productAssetListSchema,
  imageFiles: productAssetListSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Product = z.infer<typeof productSchema>;
