import { z } from 'zod';

export const floorRoutingPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

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
export type ShortestFloorPathRequest = z.infer<typeof shortestFloorPathRequestSchema>;
export type ShortestFloorPathSegment = z.infer<typeof shortestFloorPathSegmentSchema>;
export type ShortestFloorPathResponse = z.infer<typeof shortestFloorPathResponseSchema>;
export type ShortestFloorPathRpcRow = z.infer<typeof shortestFloorPathRpcRowSchema>;
