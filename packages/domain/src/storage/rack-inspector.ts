import { z } from 'zod';
import { rackAxisSchema, rackKindSchema } from '../enums/layout';
import { rackFaceRelationshipModeSchema } from '../layout/rack';

const structuralDefaultRoleSchema = z.enum(['primary_pick', 'reserve', 'none']);

export const rackInspectorFaceSchema = z.object({
  faceId: z.string().uuid(),
  side: z.enum(['A', 'B']),
  relationshipMode: rackFaceRelationshipModeSchema
});
export type RackInspectorFace = z.infer<typeof rackInspectorFaceSchema>;

export const rackInspectorLevelDefaultSchema = z.object({
  rackLevelId: z.string().uuid(),
  levelOrdinal: z.number().int().positive(),
  structuralDefaultRole: structuralDefaultRoleSchema
});
export type RackInspectorLevelDefault = z.infer<typeof rackInspectorLevelDefaultSchema>;

export const rackInspectorLevelSchema = z.object({
  /** Display ordinal (1 = floor level). Not a globally unique ID — per-section ordinals
   *  are aggregated across all sections/faces of the rack for the overview. */
  levelOrdinal: z.number().int().positive(),
  totalCells: z.number().int().nonnegative(),
  occupiedCells: z.number().int().nonnegative(),
  emptyCells: z.number().int().nonnegative(),
});
export type RackInspectorLevel = z.infer<typeof rackInspectorLevelSchema>;

export const rackInspectorPayloadSchema = z.object({
  rackId: z.string().uuid(),
  displayCode: z.string(),
  kind: rackKindSchema,
  axis: rackAxisSchema,

  /** Distinct level ordinals present in this rack (across all faces/sections). */
  totalLevels: z.number().int().nonnegative(),
  /** Total active cells in this rack across all faces/sections/levels. */
  totalCells: z.number().int().nonnegative(),

  /** Per-level breakdown, ordered by levelOrdinal ascending. */
  levels: z.array(rackInspectorLevelSchema),
  /** Canonical face relationship mode (additive contract for layout/storage consumers). */
  faces: z.array(rackInspectorFaceSchema),
  /** Per-level structural defaults keyed by concrete rack level id. */
  levelDefaults: z.array(rackInspectorLevelDefaultSchema),

  occupancySummary: z.object({
    totalCells: z.number().int().nonnegative(),
    occupiedCells: z.number().int().nonnegative(),
    emptyCells: z.number().int().nonnegative(),
    /** occupiedCells / totalCells. 0 when totalCells = 0. */
    occupancyRate: z.number().min(0).max(1),
  }),
});
export type RackInspectorPayload = z.infer<typeof rackInspectorPayloadSchema>;
