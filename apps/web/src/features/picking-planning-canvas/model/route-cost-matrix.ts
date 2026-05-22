import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import { solveGridRoute } from '@/features/obstacle-route-planning/model/grid-route-solver';
import type {
  GridRouteSolverConfig,
  RouteObstacle
} from '@/features/obstacle-route-planning/model/obstacle-types';
import type { PickingRouteAnchor } from './route-step-geometry';

export type RouteCostMatrixNode = {
  id: string;
  pointCanvas: { x: number; y: number };
  kind: 'start' | 'anchor';
  anchorIndex: number;
  stepId: string | null;
};

export type RouteCostMatrixBuildResult = {
  nodes: RouteCostMatrixNode[];
  costs: number[][];
  pairSolveCount: number;
  unreachablePairCount: number;
};

function toWorldPoint(point: { x: number; y: number }) {
  return { x: point.x / WORLD_SCALE, y: point.y / WORLD_SCALE };
}

export function buildRouteCostMatrix(params: {
  anchors: PickingRouteAnchor[];
  obstacles: RouteObstacle[];
  startCanvasPoint?: { x: number; y: number };
  solverConfig?: GridRouteSolverConfig;
}): RouteCostMatrixBuildResult {
  const resolved = params.anchors
    .map((anchor, index) => ({ anchor, index }))
    .filter(
      (
        entry
      ): entry is {
        anchor: Extract<PickingRouteAnchor, { status: 'resolved' }>;
        index: number;
      } => entry.anchor.status === 'resolved'
    );

  const nodes: RouteCostMatrixNode[] = [];
  if (params.startCanvasPoint) {
    nodes.push({
      id: '__route_start__',
      pointCanvas: params.startCanvasPoint,
      kind: 'start',
      anchorIndex: -1,
      stepId: null
    });
  }

  for (const entry of resolved) {
    nodes.push({
      id: entry.anchor.stepId,
      pointCanvas: entry.anchor.point,
      kind: 'anchor',
      anchorIndex: entry.index,
      stepId: entry.anchor.stepId
    });
  }

  const costs = Array.from({ length: nodes.length }, (_, fromIndex) =>
    Array.from({ length: nodes.length }, (_, toIndex) =>
      fromIndex === toIndex ? 0 : Number.POSITIVE_INFINITY
    )
  );

  let pairSolveCount = 0;
  let unreachablePairCount = 0;

  for (let fromIndex = 0; fromIndex < nodes.length; fromIndex += 1) {
    const fromNode = nodes[fromIndex]!;
    for (let toIndex = 0; toIndex < nodes.length; toIndex += 1) {
      if (fromIndex === toIndex) continue;
      const toNode = nodes[toIndex]!;

      const result = solveGridRoute(
        toWorldPoint(fromNode.pointCanvas),
        toWorldPoint(toNode.pointCanvas),
        params.obstacles,
        params.solverConfig
      );
      pairSolveCount += 1;

      if (result.status === 'ok') {
        costs[fromIndex]![toIndex] = result.cost;
      } else {
        unreachablePairCount += 1;
        costs[fromIndex]![toIndex] = Number.POSITIVE_INFINITY;
      }
    }
  }

  return {
    nodes,
    costs,
    pairSolveCount,
    unreachablePairCount
  };
}
