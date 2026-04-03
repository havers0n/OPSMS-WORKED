import { z } from 'zod';

export const zoneCategorySchema = z.enum([
  'generic',
  'storage',
  'staging',
  'packing',
  'receiving',
  'custom'
]);
export type ZoneCategory = z.infer<typeof zoneCategorySchema>;

export const zoneSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name: z.string().min(1),
  category: zoneCategorySchema.optional().nullable(),
  color: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});
export type Zone = z.infer<typeof zoneSchema>;
