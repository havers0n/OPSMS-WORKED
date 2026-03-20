import { z } from 'zod';

export const siteSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  timezone: z.string()
});
export type Site = z.infer<typeof siteSchema>;
