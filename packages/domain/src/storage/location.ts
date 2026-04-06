import { z } from 'zod';

export const locationTypeSchema = z.enum(['rack_slot', 'floor', 'staging', 'dock', 'buffer']);
export const capacityModeSchema = z.enum(['single_container', 'multi_container']);
export const locationStatusSchema = z.enum(['active', 'disabled', 'draft']);

/**
 * A location is the executable storage entity.
 * Geometry slots remain spatial truth and may be referenced by rack-slot locations.
 */
export const locationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  floorId: z.string().uuid(),
  code: z.string().trim().min(1),
  locationType: locationTypeSchema,
  geometrySlotId: z.string().uuid().nullable(),
  capacityMode: capacityModeSchema,
  status: locationStatusSchema,
  widthMm: z.number().int().nullable(),
  heightMm: z.number().int().nullable(),
  depthMm: z.number().int().nullable(),
  maxWeightG: z.number().int().nullable(),
  sortOrder: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type LocationType = z.infer<typeof locationTypeSchema>;
export type CapacityMode = z.infer<typeof capacityModeSchema>;
export type LocationStatus = z.infer<typeof locationStatusSchema>;
export type Location = z.infer<typeof locationSchema>;

/**
 * Lightweight projection of a non-rack location for canvas rendering.
 * floorX / floorY are world-space metres (1 unit = 1 m, matching canvas scale).
 * null means the location has not been given a canvas position yet.
 */
export const nonRackLocationRefSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1),
  locationType: locationTypeSchema,
  floorX: z.number().nullable(),
  floorY: z.number().nullable(),
  status: locationStatusSchema
});

export const nonRackLocationRefsSchema = z.array(nonRackLocationRefSchema);

export type NonRackLocationRef = z.infer<typeof nonRackLocationRefSchema>;

