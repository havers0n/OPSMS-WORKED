import { z } from 'zod';

export const floorSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int().min(0)
});
export type Floor = z.infer<typeof floorSchema>;
