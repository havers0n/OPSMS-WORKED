import { z } from 'zod';
import { containerStatusSchema } from './container';
import { locationTypeSchema } from './location';

export const locationOccupancyRowSchema = z.object({
  tenantId: z.string().uuid(),
  floorId: z.string().uuid(),
  locationId: z.string().uuid(),
  locationCode: z.string().trim().min(1),
  locationType: locationTypeSchema,
  cellId: z.string().uuid().nullable(),
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  placedAt: z.string()
});

export type LocationOccupancyRow = z.infer<typeof locationOccupancyRowSchema>;
