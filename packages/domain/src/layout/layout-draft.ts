import { z } from 'zod';
import { layoutVersionStateSchema } from '../enums/layout';
import { rackSchema } from './rack';
import { wallSchema } from './wall';
import { zoneSchema } from './zone';

export const layoutDraftSchema = z.object({
  layoutVersionId: z.string(),
  draftVersion: z.number().int().min(0).optional().nullable(),
  floorId: z.string(),
  state: layoutVersionStateSchema,
  versionNo: z.number().int().min(1).optional().nullable(),
  rackIds: z.array(z.string()),
  racks: z.record(z.string(), rackSchema),
  zoneIds: z.array(z.string()).default([]),
  zones: z.record(z.string(), zoneSchema).default({}),
  wallIds: z.array(z.string()).default([]),
  walls: z.record(z.string(), wallSchema).default({})
});
export type LayoutDraft = z.infer<typeof layoutDraftSchema>;
