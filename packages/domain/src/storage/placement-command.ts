import { z } from 'zod';

export const placeContainerRequestSchema = z.object({
  containerId: z.string().trim().min(1),
  targetCellId: z.string().uuid()
});

export const removeContainerRequestSchema = z.object({
  containerId: z.string().trim().min(1),
  fromCellId: z.string().uuid()
});

export const moveContainerRequestSchema = z.object({
  containerId: z.string().trim().min(1),
  fromCellId: z.string().uuid(),
  toCellId: z.string().uuid()
});

export const placementCommandResponseSchema = z.object({
  ok: z.literal(true),
  containerId: z.string(),
  targetCellId: z.string().optional(),
  fromCellId: z.string().optional(),
  toCellId: z.string().optional()
});

export type PlaceContainerRequest = z.infer<typeof placeContainerRequestSchema>;
export type RemoveContainerRequest = z.infer<typeof removeContainerRequestSchema>;
export type MoveContainerRequest = z.infer<typeof moveContainerRequestSchema>;
export type PlacementCommandResponse = z.infer<typeof placementCommandResponseSchema>;
