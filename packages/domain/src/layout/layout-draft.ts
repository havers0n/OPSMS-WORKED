import { z } from 'zod';
import { rackSchema } from './rack';

export const layoutDraftSchema = z.object({
  layoutVersionId: z.string(),
  floorId: z.string(),
  rackIds: z.array(z.string()),
  racks: z.record(z.string(), rackSchema)
});
export type LayoutDraft = z.infer<typeof layoutDraftSchema>;
