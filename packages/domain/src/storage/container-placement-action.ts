import { z } from 'zod';

export const placeContainerResultSchema = z.object({
  action: z.literal('placed'),
  containerId: z.string().uuid(),
  cellId: z.string().uuid(),
  placementId: z.string().uuid(),
  occurredAt: z.string()
});

export const removeContainerResultSchema = z.object({
  action: z.literal('removed'),
  containerId: z.string().uuid(),
  cellId: z.string().uuid(),
  placementId: z.string().uuid(),
  occurredAt: z.string()
});

export const moveContainerResultSchema = z.object({
  action: z.literal('moved'),
  containerId: z.string().uuid(),
  fromCellId: z.string().uuid(),
  toCellId: z.string().uuid(),
  previousPlacementId: z.string().uuid(),
  placementId: z.string().uuid(),
  occurredAt: z.string()
});

export type PlaceContainerResult = z.infer<typeof placeContainerResultSchema>;
export type RemoveContainerResult = z.infer<typeof removeContainerResultSchema>;
export type MoveContainerResult = z.infer<typeof moveContainerResultSchema>;
