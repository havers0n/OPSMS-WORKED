import { z } from 'zod';
import { locationTypeSchema } from './location';

export const containerCurrentLocationSchema = z.object({
  containerId: z.string().uuid(),
  currentLocationId: z.string().uuid().nullable(),
  locationCode: z.string().trim().min(1).nullable(),
  locationType: locationTypeSchema.nullable(),
  cellId: z.string().uuid().nullable()
});

export type ContainerCurrentLocation = z.infer<typeof containerCurrentLocationSchema>;
