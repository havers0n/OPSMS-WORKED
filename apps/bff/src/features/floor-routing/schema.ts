import { z } from 'zod';

export const floorRoutingPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const routeGraphNodeKindSchema = z.enum(['walkway', 'junction', 'pick_point', 'packing_station']);

export const routeGraphNodeDtoSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: routeGraphNodeKindSchema,
  label: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const routeGraphEdgeDtoSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  cost: z.number().finite().positive(),
  reverseCost: z.union([z.literal(-1), z.number().finite().positive()]),
  points: z.array(floorRoutingPointSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const routeGraphDtoSchema = z.object({
  nodes: z.array(routeGraphNodeDtoSchema),
  edges: z.array(routeGraphEdgeDtoSchema)
});

export const createRouteGraphNodeRequestSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  kind: routeGraphNodeKindSchema.optional(),
  label: z.string().nullable().optional()
});

export const patchRouteGraphNodeRequestSchema = createRouteGraphNodeRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Patch body must include at least one field.');

const reverseCostSchema = z.union([z.literal(-1), z.number().finite().positive()]);

const routeGraphEdgeRequestBaseSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  cost: z.number().finite().positive(),
  reverseCost: reverseCostSchema.optional(),
  points: z.array(floorRoutingPointSchema).optional()
});

export const createRouteGraphEdgeRequestSchema = routeGraphEdgeRequestBaseSchema.refine((value) => value.sourceNodeId !== value.targetNodeId, {
  message: 'sourceNodeId and targetNodeId must be different.',
  path: ['targetNodeId']
});

export const patchRouteGraphEdgeRequestSchema = routeGraphEdgeRequestBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Patch body must include at least one field.')
  .refine(
    (value) =>
      value.sourceNodeId === undefined ||
      value.targetNodeId === undefined ||
      value.sourceNodeId !== value.targetNodeId,
    {
      message: 'sourceNodeId and targetNodeId must be different.',
      path: ['targetNodeId']
    }
  );

export const shortestFloorPathRequestSchema = z.object({
  startNodeId: z.string().uuid(),
  endNodeId: z.string().uuid()
});

export const shortestFloorPathSegmentSchema = z.object({
  edgeId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  cost: z.number().finite(),
  points: z.array(floorRoutingPointSchema)
});

export const shortestFloorPathResponseSchema = z.object({
  status: z.enum(['ok', 'no_path', 'missing_node', 'graph_unavailable']),
  totalCost: z.number().finite(),
  segments: z.array(shortestFloorPathSegmentSchema),
  points: z.array(floorRoutingPointSchema)
});

export const shortestFloorPathRpcRowSchema = z.object({
  seq: z.number().int(),
  path_seq: z.number().int(),
  edge_id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  cost: z.number().finite(),
  agg_cost: z.number().finite(),
  points: z.array(floorRoutingPointSchema)
});

export const shortestFloorPathRpcRowsSchema = z.array(shortestFloorPathRpcRowSchema);

export type FloorRoutingPoint = z.infer<typeof floorRoutingPointSchema>;
export type RouteGraphNodeKind = z.infer<typeof routeGraphNodeKindSchema>;
export type RouteGraphNodeDto = z.infer<typeof routeGraphNodeDtoSchema>;
export type RouteGraphEdgeDto = z.infer<typeof routeGraphEdgeDtoSchema>;
export type RouteGraphDto = z.infer<typeof routeGraphDtoSchema>;
export type CreateRouteGraphNodeRequest = z.infer<typeof createRouteGraphNodeRequestSchema>;
export type PatchRouteGraphNodeRequest = z.infer<typeof patchRouteGraphNodeRequestSchema>;
export type CreateRouteGraphEdgeRequest = z.infer<typeof createRouteGraphEdgeRequestSchema>;
export type PatchRouteGraphEdgeRequest = z.infer<typeof patchRouteGraphEdgeRequestSchema>;
export type ShortestFloorPathRequest = z.infer<typeof shortestFloorPathRequestSchema>;
export type ShortestFloorPathSegment = z.infer<typeof shortestFloorPathSegmentSchema>;
export type ShortestFloorPathResponse = z.infer<typeof shortestFloorPathResponseSchema>;
export type ShortestFloorPathRpcRow = z.infer<typeof shortestFloorPathRpcRowSchema>;
