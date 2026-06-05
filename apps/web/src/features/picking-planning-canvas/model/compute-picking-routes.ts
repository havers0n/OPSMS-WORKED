import type { Cell, LayoutDraft } from '@wos/domain';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import { deriveDisplayedRouteSteps } from '@/entities/picking-planning/model/route-steps';
import type {
  PickingPlanningPreviewResponse,
  PickingRoutePerformanceSummary,
  PlanningRouteStepDto
} from '@/entities/picking-planning/model/types';
import type {
  PickingRouteOrderMode,
  PickingRouteStartPoint
} from '@/entities/picking-planning/model/overlay-store';
import type { FaceAccessLike } from '@/features/pick-point-resolver/model/pick-point-types';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import type { RouteComputationFlags } from '@/warehouse/editor/ui/route-computation-scope';
import {
  indexRouteAnchorStatus,
  resolveRouteStepAnchors,
  solvePickingRoute
} from './route-step-geometry';
import type { PickingRouteAnchor, SolvedRouteSegment } from './route-step-geometry';
import { sequencePickingRouteNearestNeighbor } from './sequence-route-nearest-neighbor';
import {
  DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST,
  sequencePickingRouteNearestByRouteCost
} from './sequence-route-nearest-route-cost';
import { sequencePickingRouteImprovedByRouteCost } from './sequence-route-improved-route-cost';
import { summarizePickingRouteSegments } from './summarize-picking-route-segments';

type RouteModeKey = 'original' | 'nearest' | 'nearestRouteCost' | 'improved';

type ComputedModeResult = {
  status: 'computed';
  mode: RouteModeKey;
  stepIds: string[];
  anchors: PickingRouteAnchor[];
  segments: SolvedRouteSegment[];
  diagnostics: ReturnType<typeof summarizePickingRouteSegments>;
  sequenceMs: number;
  anchorResolutionMs: number;
  solveMs: number;
  fallbackReason?: string;
  isPartial: boolean;
  pairSolveCount: number;
  unreachablePairCount: number;
};

type SkippedModeResult = {
  status: 'skipped';
  mode: RouteModeKey;
  reason: 'scope_not_computed';
  sequenceMs: 0;
  anchorResolutionMs: 0;
  solveMs: 0;
  isPartial: false;
  pairSolveCount: 0;
  unreachablePairCount: 0;
};

export type ComputedRouteModeResult = ComputedModeResult | SkippedModeResult;

export type ComputePickingRoutesInput = {
  routeSteps: PlanningRouteStepDto[];
  activeRouteOrderMode: PickingRouteOrderMode;
  routeComputationFlags: RouteComputationFlags;
  routeStartPoint: PickingRouteStartPoint | null;
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
  layout: LayoutDraft | null;
  publishedCellsById: Map<string, Cell>;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;
  obstacles: RouteObstacle[];
  nowMs?: () => number;
};

export type ComputePickingRoutesResult = {
  activeMode: RouteModeKey;
  original: ComputedRouteModeResult;
  nearest: ComputedRouteModeResult;
  nearestRouteCost: ComputedRouteModeResult;
  improved: ComputedRouteModeResult;
  active: ComputedModeResult;
  stepGeometryById: ReturnType<typeof indexRouteAnchorStatus>;
  routePerformanceSummary: PickingRoutePerformanceSummary;
  nearestRouteCostMaxResolvedAnchors: number;
  nearestRouteCostResult: {
    fallbackReason?: 'too_many_resolved_anchors';
    resolvedAnchorsCount: number;
    isPartial: boolean;
    pairSolveCount: number;
    unreachablePairCount: number;
  };
  improvedRouteCostResult: {
    fallbackReason?: string;
    pairSolveCount: number;
    unreachablePairCount: number;
    iterationCount: number;
    improvementCount: number;
    converged: boolean;
    estimatedTotalCostMetres: number | null;
    isPartial: boolean;
  };
  canvasStepIdsByMode: {
    original: string[];
    nearest: string[] | null;
    nearestRouteCost: string[] | null;
    improved: string[] | null;
  };
};

function defaultNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function asActiveModeKey(mode: PickingRouteOrderMode): RouteModeKey {
  if (mode === 'nearest-neighbor') return 'nearest';
  if (mode === 'nearest-route-cost') return 'nearestRouteCost';
  if (mode === 'improved-route-cost') return 'improved';
  return 'original';
}

export function computePickingRoutes({
  routeSteps,
  activeRouteOrderMode,
  routeComputationFlags,
  routeStartPoint,
  locationsById,
  layout,
  publishedCellsById,
  faceAccessByFaceId,
  obstacles,
  nowMs = defaultNowMs
}: ComputePickingRoutesInput): ComputePickingRoutesResult {
  const activeMode = asActiveModeKey(activeRouteOrderMode);
  const activeRouteStartCanvasPoint = routeStartPoint
    ? {
        x: routeStartPoint.x * WORLD_SCALE,
        y: routeStartPoint.y * WORLD_SCALE
      }
    : undefined;

  const startedOriginalAnchorsAtMs = nowMs();
  const originalAnchors = resolveRouteStepAnchors({
    steps: routeSteps,
    locationsById,
    layout,
    publishedCellsById,
    faceAccessByFaceId
  });
  const originalAnchorsMs = Math.max(0, nowMs() - startedOriginalAnchorsAtMs);
  const originalStepIds = originalAnchors.map((anchor) => anchor.stepId);

  let nearest: ComputedRouteModeResult = {
    status: 'skipped',
    mode: 'nearest',
    reason: 'scope_not_computed',
    sequenceMs: 0,
    anchorResolutionMs: 0,
    solveMs: 0,
    isPartial: false,
    pairSolveCount: 0,
    unreachablePairCount: 0
  };
  if (routeComputationFlags.shouldComputeNearestRoute) {
    const startedNearestSequenceAtMs = nowMs();
    const nearestStepIds = sequencePickingRouteNearestNeighbor(originalAnchors, {
      startCanvasPoint: activeRouteStartCanvasPoint
    });
    const nearestSequenceMs = Math.max(0, nowMs() - startedNearestSequenceAtMs);

    const nearestSteps = deriveDisplayedRouteSteps(routeSteps, nearestStepIds);
    const startedNearestAnchorsAtMs = nowMs();
    const nearestAnchors = resolveRouteStepAnchors({
      steps: nearestSteps,
      locationsById,
      layout,
      publishedCellsById,
      faceAccessByFaceId
    });
    const nearestAnchorsMs = Math.max(0, nowMs() - startedNearestAnchorsAtMs);

    const startedNearestSolveAtMs = nowMs();
    const nearestSegments = solvePickingRoute(
      nearestAnchors,
      obstacles,
      undefined,
      {
        startCanvasPoint: activeRouteStartCanvasPoint,
        includeDiagnostics: import.meta.env.DEV
      }
    );
    const nearestSolveMs = Math.max(0, nowMs() - startedNearestSolveAtMs);

    nearest = {
      status: 'computed',
      mode: 'nearest',
      stepIds: nearestStepIds,
      anchors: nearestAnchors,
      segments: nearestSegments,
      diagnostics: undefined as unknown as ReturnType<
        typeof summarizePickingRouteSegments
      >,
      sequenceMs: nearestSequenceMs,
      anchorResolutionMs: nearestAnchorsMs,
      solveMs: nearestSolveMs,
      isPartial: false,
      pairSolveCount: 0,
      unreachablePairCount: 0
    };
  }

  let nearestRouteCost: ComputedRouteModeResult = {
    status: 'skipped',
    mode: 'nearestRouteCost',
    reason: 'scope_not_computed',
    sequenceMs: 0,
    anchorResolutionMs: 0,
    solveMs: 0,
    isPartial: false,
    pairSolveCount: 0,
    unreachablePairCount: 0
  };
  let nearestRouteCostResolvedAnchorsCount = 0;
  if (routeComputationFlags.shouldComputeNearestRouteCostRoute) {
    const startedRouteCostSequenceAtMs = nowMs();
    const routeCostResult = sequencePickingRouteNearestByRouteCost(originalAnchors, {
      obstacles,
      startCanvasPoint: activeRouteStartCanvasPoint
    });
    nearestRouteCostResolvedAnchorsCount = routeCostResult.resolvedAnchorsCount;
    const routeCostSequenceMs = Math.max(0, nowMs() - startedRouteCostSequenceAtMs);
    const routeCostSteps = deriveDisplayedRouteSteps(routeSteps, routeCostResult.orderedStepIds);

    const startedRouteCostAnchorsAtMs = nowMs();
    const routeCostAnchors = resolveRouteStepAnchors({
      steps: routeCostSteps,
      locationsById,
      layout,
      publishedCellsById,
      faceAccessByFaceId
    });
    const routeCostAnchorsMs = Math.max(0, nowMs() - startedRouteCostAnchorsAtMs);

    const startedRouteCostSolveAtMs = nowMs();
    const routeCostSegments = solvePickingRoute(
      routeCostAnchors,
      obstacles,
      undefined,
      {
        startCanvasPoint: activeRouteStartCanvasPoint,
        includeDiagnostics: import.meta.env.DEV
      }
    );
    const routeCostSolveMs = Math.max(0, nowMs() - startedRouteCostSolveAtMs);

    nearestRouteCost = {
      status: 'computed',
      mode: 'nearestRouteCost',
      stepIds: routeCostResult.orderedStepIds,
      anchors: routeCostAnchors,
      segments: routeCostSegments,
      diagnostics: undefined as unknown as ReturnType<
        typeof summarizePickingRouteSegments
      >,
      sequenceMs: routeCostSequenceMs,
      anchorResolutionMs: routeCostAnchorsMs,
      solveMs: routeCostSolveMs,
      fallbackReason: routeCostResult.fallbackReason,
      isPartial: routeCostResult.isPartial,
      pairSolveCount: routeCostResult.pairSolveCount,
      unreachablePairCount: routeCostResult.unreachablePairCount
    };
  }
  const nearestRouteCostResult =
    nearestRouteCost.status === 'computed'
      ? {
          fallbackReason: nearestRouteCost.fallbackReason as
            | 'too_many_resolved_anchors'
            | undefined,
          resolvedAnchorsCount: nearestRouteCostResolvedAnchorsCount,
          isPartial: nearestRouteCost.isPartial,
          pairSolveCount: nearestRouteCost.pairSolveCount,
          unreachablePairCount: nearestRouteCost.unreachablePairCount
        }
      : {
          fallbackReason: undefined,
          resolvedAnchorsCount: 0,
          isPartial: false,
          pairSolveCount: 0,
          unreachablePairCount: 0
        };

  let improved: ComputedRouteModeResult = {
    status: 'skipped',
    mode: 'improved',
    reason: 'scope_not_computed',
    sequenceMs: 0,
    anchorResolutionMs: 0,
    solveMs: 0,
    isPartial: false,
    pairSolveCount: 0,
    unreachablePairCount: 0
  };
  let improvedIterationCount = 0;
  let improvedImprovementCount = 0;
  let improvedConverged = true;
  let improvedEstimatedTotalCostMetres: number | null = null;
  if (routeComputationFlags.shouldComputeImprovedRouteCostRoute) {
    const startedImprovedSequenceAtMs = nowMs();
    const improvedResult = sequencePickingRouteImprovedByRouteCost({
      anchors: originalAnchors,
      obstacles,
      startCanvasPoint: activeRouteStartCanvasPoint
    });
    improvedIterationCount = improvedResult.iterationCount;
    improvedImprovementCount = improvedResult.improvementCount;
    improvedConverged = improvedResult.converged;
    improvedEstimatedTotalCostMetres = improvedResult.estimatedTotalCostMetres;
    const improvedSequenceMs = Math.max(0, nowMs() - startedImprovedSequenceAtMs);
    const improvedSteps = deriveDisplayedRouteSteps(routeSteps, improvedResult.orderedStepIds);

    const startedImprovedAnchorsAtMs = nowMs();
    const improvedAnchors = resolveRouteStepAnchors({
      steps: improvedSteps,
      locationsById,
      layout,
      publishedCellsById,
      faceAccessByFaceId
    });
    const improvedAnchorsMs = Math.max(0, nowMs() - startedImprovedAnchorsAtMs);

    const startedImprovedSolveAtMs = nowMs();
    const improvedSegments = solvePickingRoute(
      improvedAnchors,
      obstacles,
      undefined,
      {
        startCanvasPoint: activeRouteStartCanvasPoint,
        includeDiagnostics: import.meta.env.DEV
      }
    );
    const improvedSolveMs = Math.max(0, nowMs() - startedImprovedSolveAtMs);

    improved = {
      status: 'computed',
      mode: 'improved',
      stepIds: improvedResult.orderedStepIds,
      anchors: improvedAnchors,
      segments: improvedSegments,
      diagnostics: undefined as unknown as ReturnType<
        typeof summarizePickingRouteSegments
      >,
      sequenceMs: improvedSequenceMs,
      anchorResolutionMs: improvedAnchorsMs,
      solveMs: improvedSolveMs,
      fallbackReason: improvedResult.fallbackReason,
      isPartial: improvedResult.isPartial,
      pairSolveCount: improvedResult.pairSolveCount,
      unreachablePairCount: improvedResult.unreachablePairCount
    };
  }
  const improvedRouteCostResult =
    improved.status === 'computed'
      ? {
          fallbackReason: improved.fallbackReason,
          pairSolveCount: improved.pairSolveCount,
          unreachablePairCount: improved.unreachablePairCount,
          iterationCount: improvedIterationCount,
          improvementCount: improvedImprovementCount,
          converged: improvedConverged,
          estimatedTotalCostMetres: improvedEstimatedTotalCostMetres,
          isPartial: improved.isPartial
        }
      : {
          fallbackReason: undefined,
          pairSolveCount: 0,
          unreachablePairCount: 0,
          iterationCount: 0,
          improvementCount: 0,
          converged: true,
          estimatedTotalCostMetres: null,
          isPartial: false
        };

  const startedOriginalSolveAtMs = nowMs();
  const originalSegments = solvePickingRoute(
    originalAnchors,
    obstacles,
    undefined,
    {
      startCanvasPoint: activeRouteStartCanvasPoint,
      includeDiagnostics: import.meta.env.DEV
    }
  );
  const originalSolveMs = Math.max(0, nowMs() - startedOriginalSolveAtMs);

  const startedRouteDiagnosticsAtMs = nowMs();
  const originalDiagnostics = summarizePickingRouteSegments(originalSegments);
  const nearestDiagnostics =
    nearest.status === 'computed'
      ? summarizePickingRouteSegments(nearest.segments)
      : null;
  const nearestRouteCostDiagnostics =
    nearestRouteCost.status === 'computed'
      ? summarizePickingRouteSegments(nearestRouteCost.segments)
      : null;
  const improvedDiagnostics =
    improved.status === 'computed'
      ? summarizePickingRouteSegments(improved.segments)
      : null;
  const routeDiagnosticsMs = Math.max(0, nowMs() - startedRouteDiagnosticsAtMs);

  const original: ComputedModeResult = {
    status: 'computed',
    mode: 'original',
    stepIds: originalStepIds,
    anchors: originalAnchors,
    segments: originalSegments,
    diagnostics: originalDiagnostics,
    sequenceMs: 0,
    anchorResolutionMs: originalAnchorsMs,
    solveMs: originalSolveMs,
    isPartial: false,
    pairSolveCount: 0,
    unreachablePairCount: 0
  };

  const active =
    activeMode === 'nearest'
      ? nearest.status === 'computed'
        ? nearest
        : original
      : activeMode === 'nearestRouteCost'
        ? nearestRouteCost.status === 'computed'
          ? nearestRouteCost
          : original
        : activeMode === 'improved'
          ? improved.status === 'computed'
            ? improved
            : original
          : original;

  if (nearest.status === 'computed') {
    nearest = { ...nearest, diagnostics: nearestDiagnostics! };
  }
  if (nearestRouteCost.status === 'computed') {
    nearestRouteCost = {
      ...nearestRouteCost,
      diagnostics: nearestRouteCostDiagnostics!
    };
  }
  if (improved.status === 'computed') {
    improved = { ...improved, diagnostics: improvedDiagnostics! };
  }

  const originalAnchorCount = originalAnchors.length;
  const resolvedAnchorCount = originalAnchors.filter(
    (anchor) => anchor.status === 'resolved'
  ).length;
  const unresolvedAnchorCount = originalAnchorCount - resolvedAnchorCount;
  const obstacleCount = obstacles.length;
  const rackObstacleCount = obstacles.filter((obstacle) => obstacle.type === 'rack').length;
  const wallObstacleCount = obstacleCount - rackObstacleCount;
  const routeSegmentCount = active.segments.length;

  const anchorResolutionTotalMs =
    original.anchorResolutionMs +
    nearest.anchorResolutionMs +
    nearestRouteCost.anchorResolutionMs +
    improved.anchorResolutionMs;
  const solveTotalMs =
    original.solveMs +
    nearest.solveMs +
    nearestRouteCost.solveMs +
    improved.solveMs;
  const totalRouteComputeMs =
    anchorResolutionTotalMs +
    solveTotalMs +
    nearest.sequenceMs +
    nearestRouteCost.sequenceMs +
    improved.sequenceMs +
    routeDiagnosticsMs;

  return {
    activeMode,
    original,
    nearest,
    nearestRouteCost,
    improved,
    active,
    stepGeometryById: indexRouteAnchorStatus(active.anchors),
    routePerformanceSummary: {
      scope: routeComputationFlags.scope,
      computedModes: {
        original: true,
        nearest: nearest.status === 'computed',
        nearestRouteCost: nearestRouteCost.status === 'computed',
        improved: improved.status === 'computed'
      },
      anchorResolutionMs: {
        original: original.anchorResolutionMs,
        nearest: nearest.anchorResolutionMs,
        nearestRouteCost: nearestRouteCost.anchorResolutionMs,
        improved: improved.anchorResolutionMs,
        total: anchorResolutionTotalMs
      },
      solveMs: {
        original: original.solveMs,
        nearest: nearest.solveMs,
        nearestRouteCost: nearestRouteCost.solveMs,
        improved: improved.solveMs,
        total: solveTotalMs
      },
      sequenceMs: {
        nearest: nearest.sequenceMs,
        nearestRouteCost: nearestRouteCost.sequenceMs,
        improved: improved.sequenceMs
      },
      routeDiagnosticsMs,
      totalRouteComputeMs,
      counts: {
        anchorCount: originalAnchorCount,
        resolvedAnchorCount,
        unresolvedAnchorCount,
        obstacleCount,
        rackObstacleCount,
        wallObstacleCount,
        routeSegmentCount
      },
      mode: {
        activeMode: activeRouteOrderMode,
        hasManualStartPoint: !!activeRouteStartCanvasPoint,
        nearestRouteCostFallbackReason:
          nearestRouteCostResult.fallbackReason,
        nearestRouteCostIsPartial: nearestRouteCostResult.isPartial,
        improvedRouteCostFallbackReason:
          improvedRouteCostResult.fallbackReason,
        improvedRouteCostIsPartial: improvedRouteCostResult.isPartial
      },
      pairStats: {
        nearestRouteCostPairSolveCount: nearestRouteCostResult.pairSolveCount,
        nearestRouteCostUnreachablePairCount:
          nearestRouteCostResult.unreachablePairCount,
        improvedRouteCostPairSolveCount: improvedRouteCostResult.pairSolveCount,
        improvedRouteCostUnreachablePairCount:
          improvedRouteCostResult.unreachablePairCount
      },
      policy: routeComputationFlags.policy
    },
    nearestRouteCostMaxResolvedAnchors: DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST,
    nearestRouteCostResult,
    improvedRouteCostResult,
    canvasStepIdsByMode: {
      original: original.stepIds,
      nearest: nearest.status === 'computed' ? nearest.stepIds : null,
      nearestRouteCost:
        nearestRouteCost.status === 'computed' ? nearestRouteCost.stepIds : null,
      improved: improved.status === 'computed' ? improved.stepIds : null
    }
  };
}
