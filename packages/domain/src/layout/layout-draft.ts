import { z } from 'zod';
import { layoutVersionStateSchema } from '../enums/layout';
import { rackSchema } from './rack';

export const layoutDraftSchema = z.object({
  layoutVersionId: z.string(),
  floorId: z.string(),
  state: layoutVersionStateSchema,
  versionNo: z.number().int().min(1),
  rackIds: z.array(z.string()),
  racks: z.record(z.string(), rackSchema)
});
export type LayoutDraft = z.infer<typeof layoutDraftSchema>;
