import { z } from 'zod';
import { layoutVersionStateSchema } from '../enums/layout';

export const layoutVersionSchema = z.object({
  id: z.string(),
  floorId: z.string(),
  state: layoutVersionStateSchema,
  versionNo: z.number().int().min(1)
});
export type LayoutVersion = z.infer<typeof layoutVersionSchema>;

export const publishedLayoutSummarySchema = z.object({
  layoutVersionId: z.string(),
  floorId: z.string(),
  versionNo: z.number().int().min(1),
  publishedAt: z.string(),
  cellCount: z.number().int().min(0),
  sampleAddresses: z.array(z.string())
});
export type PublishedLayoutSummary = z.infer<typeof publishedLayoutSummarySchema>;
