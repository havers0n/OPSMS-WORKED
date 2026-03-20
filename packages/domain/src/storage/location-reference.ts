import { z } from 'zod';
import { locationTypeSchema } from './location';

export const locationReferenceSchema = z.object({
  locationId: z.string().uuid(),
  locationCode: z.string().trim().min(1),
  locationType: locationTypeSchema,
  cellId: z.string().uuid().nullable()
});

export type LocationReference = z.infer<typeof locationReferenceSchema>;
