import { z } from 'zod';

export const layoutVersionStateSchema = z.enum(['draft', 'published', 'archived']);
export type LayoutVersionState = z.infer<typeof layoutVersionStateSchema>;

export const rackKindSchema = z.enum(['single', 'paired']);
export type RackKind = z.infer<typeof rackKindSchema>;

export const rackAxisSchema = z.enum(['NS', 'WE']);
export type RackAxis = z.infer<typeof rackAxisSchema>;

export const rackFaceSideSchema = z.enum(['A', 'B']);
export type RackFaceSide = z.infer<typeof rackFaceSideSchema>;

export const rackFaceAnchorSchema = z.enum(['start', 'end']);
export type RackFaceAnchor = z.infer<typeof rackFaceAnchorSchema>;

export const slotNumberingDirectionSchema = z.enum(['ltr', 'rtl']);
export type SlotNumberingDirection = z.infer<typeof slotNumberingDirectionSchema>;
