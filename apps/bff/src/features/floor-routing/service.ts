import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFloorRoutingRepo, type FloorRoutingRepo } from './repo.js';
import type {
  FloorRoutingPoint,
  ShortestFloorPathResponse,
  ShortestFloorPathRpcRow,
  ShortestFloorPathSegment
} from './schema.js';

type ShortestPathInput = {
  tenantId: string;
  floorId: string;
  startNodeId: string;
  endNodeId: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const graphDependencyErrorCodes = new Set(['PGRST202', '42883', '42P01', '42703', '3F000']);

function emptyResponse(status: ShortestFloorPathResponse['status']): ShortestFloorPathResponse {
  return {
    status,
    totalCost: 0,
    segments: [],
    points: []
  };
}

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

function isKnownGraphDependencyFailure(error: unknown): boolean {
  if (error instanceof ZodError) {
    return true;
  }

  if (!isSupabaseLikeError(error) || !error.code || !graphDependencyErrorCodes.has(error.code)) {
    return false;
  }

  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase();
  return [
    'get_shortest_floor_path',
    'floor_route_nodes',
    'floor_route_edges',
    'pgr_dijkstra',
    'pgrouting',
    'postgis'
  ].some((needle) => text.includes(needle));
}

function samePoint(left: FloorRoutingPoint, right: FloorRoutingPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function flattenSegmentPoints(segments: ShortestFloorPathSegment[]): FloorRoutingPoint[] {
  const points: FloorRoutingPoint[] = [];

  for (const segment of segments) {
    for (const point of segment.points) {
      const previous = points.at(-1);
      if (!previous || !samePoint(previous, point)) {
        points.push(point);
      }
    }
  }

  return points;
}

function mapRowToSegment(row: ShortestFloorPathRpcRow): ShortestFloorPathSegment {
  return {
    edgeId: row.edge_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    cost: row.cost,
    points: row.points
  };
}

function resolveTotalCost(rows: ShortestFloorPathRpcRow[], segments: ShortestFloorPathSegment[]): number {
  const lastAggCost = rows.at(-1)?.agg_cost;
  if (typeof lastAggCost === 'number' && Number.isFinite(lastAggCost)) {
    return lastAggCost;
  }

  return segments.reduce((total, segment) => total + segment.cost, 0);
}

export type FloorRoutingService = {
  getShortestPath(input: ShortestPathInput): Promise<ShortestFloorPathResponse>;
};

export function createFloorRoutingService(repoOrSupabase: FloorRoutingRepo | SupabaseClient): FloorRoutingService {
  const repo: FloorRoutingRepo =
    'listExistingNodeIds' in repoOrSupabase
      ? repoOrSupabase
      : createFloorRoutingRepo(repoOrSupabase);

  return {
    async getShortestPath(input) {
      if (input.startNodeId === input.endNodeId) {
        return emptyResponse('ok');
      }

      let rows: ShortestFloorPathRpcRow[];

      try {
        const existingNodeIds = new Set(
          await repo.listExistingNodeIds(input.tenantId, input.floorId, [
            input.startNodeId,
            input.endNodeId
          ])
        );

        if (!existingNodeIds.has(input.startNodeId) || !existingNodeIds.has(input.endNodeId)) {
          return emptyResponse('missing_node');
        }

        rows = await repo.getShortestFloorPath(
          input.tenantId,
          input.floorId,
          input.startNodeId,
          input.endNodeId
        );
      } catch (error) {
        if (isKnownGraphDependencyFailure(error)) {
          return emptyResponse('graph_unavailable');
        }
        throw error;
      }

      if (rows.length === 0) {
        return emptyResponse('no_path');
      }

      const segments = rows.map(mapRowToSegment);
      return {
        status: 'ok',
        totalCost: resolveTotalCost(rows, segments),
        segments,
        points: flattenSegmentPoints(segments)
      };
    }
  };
}
