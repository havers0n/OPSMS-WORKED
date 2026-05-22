import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import type { PickingRouteAnchor } from './route-step-geometry';
import { buildRouteCostMatrix } from './route-cost-matrix';
import {
  DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST,
  sequencePickingRouteNearestByRouteCost
} from './sequence-route-nearest-route-cost';

export const DEFAULT_MAX_ITERATIONS_FOR_IMPROVED_ROUTE_COST = 100;
export const DEFAULT_MAX_SWAP_EVALUATIONS_FOR_IMPROVED_ROUTE_COST = 5000;

type ImprovedRouteCostFallbackReason =
  | 'too_many_resolved_anchors'
  | 'route_cost_seed_fallback';

export type ImprovedRouteCostSequenceResult = {
  orderedStepIds: string[];
  estimatedTotalCostMetres: number | null;
  fallbackReason?: ImprovedRouteCostFallbackReason;
  resolvedAnchorsCount: number;
  unresolvedAnchorsCount: number;
  pairSolveCount: number;
  unreachablePairCount: number;
  iterationCount: number;
  improvementCount: number;
  converged: boolean;
  isPartial: boolean;
};

const EPSILON = 1e-9;

function computeRouteCost(order: number[], startIndex: number | null, costs: number[][]) {
  if (order.length === 0) return 0;

  let totalCost = 0;

  if (startIndex !== null) {
    const first = order[0]!;
    totalCost += costs[startIndex]![first]!;
  }

  for (let index = 1; index < order.length; index += 1) {
    const prev = order[index - 1]!;
    const current = order[index]!;
    totalCost += costs[prev]![current]!;
  }

  return totalCost;
}

function hasInfiniteLeg(order: number[], startIndex: number | null, costs: number[][]) {
  if (order.length === 0) return false;

  if (startIndex !== null) {
    const first = order[0]!;
    if (!Number.isFinite(costs[startIndex]![first]!)) return true;
  }

  for (let index = 1; index < order.length; index += 1) {
    const prev = order[index - 1]!;
    const current = order[index]!;
    if (!Number.isFinite(costs[prev]![current]!)) return true;
  }

  return false;
}

export function sequencePickingRouteImprovedByRouteCost(params: {
  anchors: PickingRouteAnchor[];
  obstacles: RouteObstacle[];
  startCanvasPoint?: { x: number; y: number };
  maxResolvedAnchorsForImproved?: number;
  maxIterations?: number;
  maxSwapEvaluations?: number;
}) : ImprovedRouteCostSequenceResult {
  const unresolvedAnchors = params.anchors.filter(
    (anchor): anchor is Extract<PickingRouteAnchor, { status: 'unresolved' }> =>
      anchor.status === 'unresolved'
  );
  const resolvedAnchors = params.anchors.filter(
    (anchor): anchor is Extract<PickingRouteAnchor, { status: 'resolved' }> =>
      anchor.status === 'resolved'
  );

  const maxResolvedAnchorsForImproved =
    params.maxResolvedAnchorsForImproved ??
    DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST;

  if (resolvedAnchors.length <= 1) {
    return {
      orderedStepIds: params.anchors.map((anchor) => anchor.stepId),
      estimatedTotalCostMetres: 0,
      resolvedAnchorsCount: resolvedAnchors.length,
      unresolvedAnchorsCount: unresolvedAnchors.length,
      pairSolveCount: 0,
      unreachablePairCount: 0,
      iterationCount: 0,
      improvementCount: 0,
      converged: true,
      isPartial: false
    };
  }

  if (resolvedAnchors.length > maxResolvedAnchorsForImproved) {
    const seed = sequencePickingRouteNearestByRouteCost(params.anchors, {
      obstacles: params.obstacles,
      startCanvasPoint: params.startCanvasPoint,
      maxResolvedAnchorsForRouteCost: maxResolvedAnchorsForImproved
    });
    return {
      orderedStepIds: seed.orderedStepIds,
      estimatedTotalCostMetres: null,
      fallbackReason: 'too_many_resolved_anchors',
      resolvedAnchorsCount: resolvedAnchors.length,
      unresolvedAnchorsCount: unresolvedAnchors.length,
      pairSolveCount: seed.pairSolveCount,
      unreachablePairCount: seed.unreachablePairCount,
      iterationCount: 0,
      improvementCount: 0,
      converged: true,
      isPartial: seed.isPartial
    };
  }

  const seed = sequencePickingRouteNearestByRouteCost(params.anchors, {
    obstacles: params.obstacles,
    startCanvasPoint: params.startCanvasPoint,
    maxResolvedAnchorsForRouteCost: maxResolvedAnchorsForImproved
  });

  if (seed.fallbackReason) {
    return {
      orderedStepIds: seed.orderedStepIds,
      estimatedTotalCostMetres: null,
      fallbackReason: 'route_cost_seed_fallback',
      resolvedAnchorsCount: resolvedAnchors.length,
      unresolvedAnchorsCount: unresolvedAnchors.length,
      pairSolveCount: seed.pairSolveCount,
      unreachablePairCount: seed.unreachablePairCount,
      iterationCount: 0,
      improvementCount: 0,
      converged: true,
      isPartial: seed.isPartial
    };
  }

  const matrix = buildRouteCostMatrix({
    anchors: params.anchors,
    obstacles: params.obstacles,
    startCanvasPoint: params.startCanvasPoint
  });

  const startIndex = matrix.nodes.findIndex((node) => node.kind === 'start');
  const normalizedStartIndex = startIndex >= 0 ? startIndex : null;

  const anchorNodeIndices = matrix.nodes
    .map((node, index) => ({ node, index }))
    .filter((entry) => entry.node.kind === 'anchor')
    .sort((left, right) => left.node.anchorIndex - right.node.anchorIndex)
    .map((entry) => entry.index);

  const anchorIndexByStepId = new Map<string, number>(
    matrix.nodes
      .map((node, index) => [node.stepId, index] as const)
      .filter(
        (
          entry
        ): entry is readonly [string, number] => entry[0] !== null
      )
  );

  const seedResolvedStepIds = seed.orderedStepIds.filter((stepId) =>
    resolvedAnchors.some((anchor) => anchor.stepId === stepId)
  );

  const seedOrder = seedResolvedStepIds
    .map((stepId) => anchorIndexByStepId.get(stepId) ?? null)
    .filter((index): index is number => index !== null);

  const remaining = anchorNodeIndices.filter((index) => !seedOrder.includes(index));
  let currentOrder = [...seedOrder, ...remaining];

  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS_FOR_IMPROVED_ROUTE_COST;
  const maxSwapEvaluations =
    params.maxSwapEvaluations ?? DEFAULT_MAX_SWAP_EVALUATIONS_FOR_IMPROVED_ROUTE_COST;

  let currentCost = computeRouteCost(currentOrder, normalizedStartIndex, matrix.costs);
  let iterationCount = 0;
  let improvementCount = 0;
  let swapEvaluations = 0;
  let converged = true;

  while (iterationCount < maxIterations) {
    let improvedThisIteration = false;

    for (let left = 0; left < currentOrder.length - 1; left += 1) {
      for (let right = left + 1; right < currentOrder.length; right += 1) {
        if (swapEvaluations >= maxSwapEvaluations) {
          converged = false;
          break;
        }
        swapEvaluations += 1;

        const nextOrder = [
          ...currentOrder.slice(0, left),
          ...currentOrder.slice(left, right + 1).reverse(),
          ...currentOrder.slice(right + 1)
        ];

        const nextCost = computeRouteCost(nextOrder, normalizedStartIndex, matrix.costs);
        if (nextCost < currentCost - EPSILON) {
          currentOrder = nextOrder;
          currentCost = nextCost;
          improvementCount += 1;
          improvedThisIteration = true;
        }
      }
      if (!converged) break;
    }

    iterationCount += 1;

    if (!converged) break;
    if (!improvedThisIteration) break;
  }

  const unresolvedStepIds = unresolvedAnchors.map((anchor) => anchor.stepId);
  const resolvedStepIds = currentOrder
    .map((index) => matrix.nodes[index]!.stepId)
    .filter((stepId): stepId is string => stepId !== null);

  const orderedStepIds = [...resolvedStepIds, ...unresolvedStepIds];
  const hasUnreachableLeg = hasInfiniteLeg(currentOrder, normalizedStartIndex, matrix.costs);

  return {
    orderedStepIds,
    estimatedTotalCostMetres: Number.isFinite(currentCost) ? currentCost : null,
    resolvedAnchorsCount: resolvedAnchors.length,
    unresolvedAnchorsCount: unresolvedAnchors.length,
    pairSolveCount: matrix.pairSolveCount,
    unreachablePairCount: matrix.unreachablePairCount,
    iterationCount,
    improvementCount,
    converged,
    isPartial: hasUnreachableLeg
  };
}
