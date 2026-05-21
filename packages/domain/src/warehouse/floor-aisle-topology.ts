import { z } from 'zod';

export const floorAisleTopologyAisleSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().nullable().optional()
});

export const floorAisleTopologyFaceAccessSchema = z.object({
  faceId: z.string().uuid(),
  aisleId: z.string().uuid(),
  normalX: z.number().finite(),
  normalY: z.number().finite()
});

export const floorAisleTopologySchema = z.object({
  floorId: z.string().uuid(),
  aisles: z.array(floorAisleTopologyAisleSchema),
  faceAccess: z.array(floorAisleTopologyFaceAccessSchema)
});

export type FloorAisleTopologyAisle = z.infer<typeof floorAisleTopologyAisleSchema>;
export type FloorAisleTopologyFaceAccess = z.infer<typeof floorAisleTopologyFaceAccessSchema>;
export type FloorAisleTopology = z.infer<typeof floorAisleTopologySchema>;
