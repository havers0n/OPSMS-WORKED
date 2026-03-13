import { z } from 'zod';

export const containerPlacementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  cellId: z.string().uuid(),
  placedAt: z.string(),
  removedAt: z.string().nullable(),
  placedBy: z.string().uuid().nullable(),
  removedBy: z.string().uuid().nullable()
});

export type ContainerPlacement = z.infer<typeof containerPlacementSchema>;
