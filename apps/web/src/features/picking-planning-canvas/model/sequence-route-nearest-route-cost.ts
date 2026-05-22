import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import { solveGridRoute } from '@/features/obstacle-route-planning/model/grid-route-solver';
import type {
  GridRouteSolverConfig,
  RouteObstacle
} from '@/features/obstacle-route-planning/model/obstacle-types';
import type { PickingRouteAnchor } from './route-step-geometry';

export type RouteStartCanvasPoint = { x: number; y: number };

export const DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST = 25;

export type RouteCostSequenceFallbackReason = 'too_many_resolved_anchors';

export type RouteCostSequenceResult = {
  orderedStepIds: string[];
  isPartial: boolean;
  fallbackReason?: RouteCostSequenceFallbackReason;
  resolvedAnchorsCount: number;
  unresolvedTransitionCount: number;
  pairSolveCount: number;
  unreachablePairCount: number;
};

type ResolvedEntry = {
  anchor: Extract<PickingRouteAnchor, { status: 'resolved' }>;
  index: number;
};

function toWorldPoint(point: { x: number; y: number }) {
  return { x: point.x / WORLD_SCALE, y: point.y / WORLD_SCALE };
}

export function sequencePickingRouteNearestByRouteCost(
  anchors: PickingRouteAnchor[],
  params: {
    obstacles: RouteObstacle[];
    startCanvasPoint?: RouteStartCanvasPoint;
    solverConfig?: GridRouteSolverConfig;
    maxResolvedAnchorsForRouteCost?: number;
  }
): RouteCostSequenceResult {
  if (anchors.length === 0) {
    return {
      orderedStepIds: [],
      isPartial: false,
      resolvedAnchorsCount: 0,
      unresolvedTransitionCount: 0,
      pairSolveCount: 0,
      unreachablePairCount: 0
    };
  }

  const resolved = anchors
    .map((anchor, index) => ({ anchor, index }))
    .filter(
      (
        entry
      ): entry is {
        anchor: Extract<PickingRouteAnchor, { status: 'resolved' }>;
        index: number;
      } => entry.anchor.status === 'resolved'
    );
  const maxResolvedAnchorsForRouteCost =
    params.maxResolvedAnchorsForRouteCost ??
    DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST;

  if (resolved.length <= 1) {
    return {
      orderedStepIds: anchors.map((anchor) => anchor.stepId),
      isPartial: false,
      resolvedAnchorsCount: resolved.length,
      unresolvedTransitionCount: 0,
      pairSolveCount: 0,
      unreachablePairCount: 0
    };
  }

  if (resolved.length > maxResolvedAnchorsForRouteCost) {
    return {
      orderedStepIds: anchors.map((anchor) => anchor.stepId),
      isPartial: false,
      fallbackReason: 'too_many_resolved_anchors',
      resolvedAnchorsCount: resolved.length,
      unresolvedTransitionCount: 0,
      pairSolveCount: 0,
      unreachablePairCount: 0
    };
  }

  const visited = new Set<number>();
  const orderedResolved: ResolvedEntry[] = [];
  const pairCostCache = new Map<string, number | null>();
  let pairSolveCount = 0;
  let unreachablePairCount = 0;

  const readPairCost = (
    fromPoint: { x: number; y: number },
    to: ResolvedEntry,
    cacheKey: string
  ): number | null => {
    const cached = pairCostCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const result = solveGridRoute(
      toWorldPoint(fromPoint),
      toWorldPoint(to.anchor.point),
      params.obstacles,
      params.solverConfig
    );
    pairSolveCount += 1;
    if (result.status !== 'ok') {
      unreachablePairCount += 1;
    }
    const cost = result.status === 'ok' ? result.cost : null;
    pairCostCache.set(cacheKey, cost);
    return cost;
  };

  const pickBestFrom = (
    fromPoint: { x: number; y: number },
    fromKey: string
  ): ResolvedEntry | null => {
    let best: ResolvedEntry | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const candidate of resolved) {
      if (visited.has(candidate.index)) continue;
      const cacheKey = `${fromKey}->${candidate.anchor.stepId}`;
      const cost = readPairCost(fromPoint, candidate, cacheKey);
      if (cost === null) continue;
      if (
        cost < bestCost ||
        (cost === bestCost && best !== null && candidate.index < best.index)
      ) {
        best = candidate;
        bestCost = cost;
      }
    }

    return best;
  };

  const startCanvasPoint = params.startCanvasPoint;
  let current =
    startCanvasPoint === undefined
      ? resolved[0]!
      : pickBestFrom(startCanvasPoint, '__route_start__');

  if (!current) {
    return {
      orderedStepIds: anchors.map((anchor) => anchor.stepId),
      isPartial: true,
      resolvedAnchorsCount: resolved.length,
      unresolvedTransitionCount: resolved.length,
      pairSolveCount,
      unreachablePairCount
    };
  }

  visited.add(current.index);
  orderedResolved.push(current);

  while (orderedResolved.length < resolved.length) {
    const next = pickBestFrom(current.anchor.point, current.anchor.stepId);
    if (!next) break;
    visited.add(next.index);
    orderedResolved.push(next);
    current = next;
  }

  const remainingResolved = resolved
    .filter((entry) => !visited.has(entry.index))
    .sort((a, b) => a.index - b.index);
  const unresolvedStepIds = anchors
    .filter((anchor) => anchor.status === 'unresolved')
    .map((anchor) => anchor.stepId);

  return {
    orderedStepIds: [
      ...orderedResolved.map((entry) => entry.anchor.stepId),
      ...remainingResolved.map((entry) => entry.anchor.stepId),
      ...unresolvedStepIds
    ],
    isPartial: remainingResolved.length > 0,
    resolvedAnchorsCount: resolved.length,
    unresolvedTransitionCount: remainingResolved.length,
    pairSolveCount,
    unreachablePairCount
  };
}
