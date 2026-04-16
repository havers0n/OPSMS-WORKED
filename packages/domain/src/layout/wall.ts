import { z } from 'zod';

export const wallTypeSchema = z.enum([
  'generic',
  'partition',
  'safety',
  'perimeter',
  'custom'
]);
export type WallType = z.infer<typeof wallTypeSchema>;

export const wallSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name: z.string().min(1).optional().nullable(),
  wallType: wallTypeSchema.optional().nullable(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  blocksRackPlacement: z.boolean().default(true)
});
export type Wall = z.infer<typeof wallSchema>;
