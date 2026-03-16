import { z } from 'zod';
import { containerStatusSchema } from './container';

/**
 * Legacy compatibility DTO for geometry-backed occupancy reads.
 * New execution-facing APIs should prefer LocationOccupancyRow.
 */
export const cellOccupancyRowSchema = z.object({
  tenantId: z.string().uuid(),
  cellId: z.string().uuid(),
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  placedAt: z.string()
});

export type CellOccupancyRow = z.infer<typeof cellOccupancyRowSchema>;

export const floorCellOccupancyRowSchema = z.object({
  cellId: z.string().uuid(),
  containerCount: z.number().int().min(1)
});

export const floorCellOccupancyResponseSchema = z.array(floorCellOccupancyRowSchema);

export type FloorCellOccupancyRow = z.infer<typeof floorCellOccupancyRowSchema>;
