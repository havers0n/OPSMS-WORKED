import { z } from 'zod';
import { rackAxisSchema, rackKindSchema } from '../enums/layout';

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

  occupancySummary: z.object({
    totalCells: z.number().int().nonnegative(),
    occupiedCells: z.number().int().nonnegative(),
    emptyCells: z.number().int().nonnegative(),
    /** occupiedCells / totalCells. 0 when totalCells = 0. */
    occupancyRate: z.number().min(0).max(1),
  }),
});
export type RackInspectorPayload = z.infer<typeof rackInspectorPayloadSchema>;
