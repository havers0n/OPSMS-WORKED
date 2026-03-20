import { z } from 'zod';
import { layoutDraftSchema } from '../layout/layout-draft';

export const floorWorkspaceSchema = z.object({
  floorId: z.string(),
  activeDraft: layoutDraftSchema.nullable(),
  latestPublished: layoutDraftSchema.nullable()
});

export type FloorWorkspace = z.infer<typeof floorWorkspaceSchema>;
