import { z } from 'zod';
import { containerStatusSchema } from './container';

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
