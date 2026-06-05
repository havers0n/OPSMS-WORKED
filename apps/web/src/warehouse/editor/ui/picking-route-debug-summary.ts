import type { Cell } from '@wos/domain';
import type {
  PickingPlanningPreviewResponse,
  PickingRoutePerformanceSummary,
  PlanningRouteStepDto
} from '@/entities/picking-planning/model/types';
import type { FaceAccessLike } from '@/features/pick-point-resolver/model/pick-point-types';
import type {
  PickingRouteAnchor,
  SolvedRouteSegment
} from '@/features/picking-planning-canvas/model/route-step-geometry';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import { DEFAULT_GRID_ROUTE_SOLVER_CONFIG } from '@/features/obstacle-route-planning/model/obstacle-types';
import type { TenantMembership } from '@/shared/api/bff/use-workspace-session';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';

type QueryStatus = 'pending' | 'error' | 'success';

type DetailedDiagnosticsPayload = NonNullable<
  NonNullable<PickingRoutePerformanceSummary['debug']>['detailedDiagnostics']
>;

function roundDiagnosticNumber(value: number) {
  return Number(value.toFixed(4));
}

function roundPoint(point: { x: number; y: number } | null | undefined) {
  if (!point) return null;
  return {
    x: roundDiagnosticNumber(point.x),
    y: roundDiagnosticNumber(point.y)
  };
}

function resolveCurrentMembership({
  currentTenantId,
  memberships
}: {
  currentTenantId: string | null;
  memberships: TenantMembership[];
}) {
  if (currentTenantId) {
    return (
      memberships.find((membership) => membership.tenantId === currentTenantId) ??
      null
    );
  }

  return memberships[0] ?? null;
}

export function isPickingRouteDetailedDiagnosticsEnabled({
  isDev,
  currentTenantId,
  memberships,
  search
}: {
  isDev: boolean;
  currentTenantId: string | null;
  memberships: TenantMembership[];
  search: string;
}) {
  if (isDev) {
    return true;
  }

  const query = new URLSearchParams(search);
  if (query.get('pickingRouteDebug') !== '1') {
    return false;
  }

  const currentMembership = resolveCurrentMembership({
    currentTenantId,
    memberships
  });

  return (
    currentMembership?.role === 'tenant_admin' ||
    currentMembership?.role === 'platform_admin'
  );
}

export function buildObstacleSignature(obstacles: RouteObstacle[]) {
  return obstacles
    .map((obstacle) => {
      if (obstacle.type === 'rack') {
        return {
          type: obstacle.type,
          id: obstacle.id,
          x: roundDiagnosticNumber(obstacle.x),
          y: roundDiagnosticNumber(obstacle.y),
          width: roundDiagnosticNumber(obstacle.width),
          height: roundDiagnosticNumber(obstacle.height)
        };
      }

      return {
        type: obstacle.type,
        id: obstacle.id,
        x: roundDiagnosticNumber(Math.min(obstacle.x1, obstacle.x2)),
        y: roundDiagnosticNumber(Math.min(obstacle.y1, obstacle.y2)),
        width: roundDiagnosticNumber(Math.abs(obstacle.x2 - obstacle.x1)),
        height: roundDiagnosticNumber(Math.abs(obstacle.y2 - obstacle.y1))
      };
    })
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    )
    .map((entry) => JSON.stringify(entry))
    .join('|');
}

export function buildAnchorSignature(anchors: PickingRouteAnchor[]) {
  return anchors
    .map((anchor, index) =>
      JSON.stringify({
        index,
        stepId: anchor.stepId,
        routePosition: index + 1,
        status: anchor.status,
        canvasPoint:
          anchor.status === 'resolved' ? roundPoint(anchor.point) : null,
        worldPoint:
          anchor.status === 'resolved'
            ? roundPoint({
                x: anchor.point.x / WORLD_SCALE,
                y: anchor.point.y / WORLD_SCALE
              })
            : null,
        unresolvedReason:
          anchor.status === 'unresolved' ? anchor.reason : null
      })
    )
    .join('|');
}

function collectRequiredCellIds({
  routeSteps,
  locationsById
}: {
  routeSteps: PlanningRouteStepDto[];
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
}) {
  const requiredCellIds = new Set<string>();
  for (const step of routeSteps) {
    const locationId = step.fromLocationId;
    if (!locationId) continue;
    const cellId = locationsById?.[locationId]?.cellId;
    if (cellId) {
      requiredCellIds.add(cellId);
    }
  }

  return [...requiredCellIds].sort();
}

export function buildPickingRouteDetailedDiagnostics({
  routeSteps,
  locationsById,
  publishedCellsById,
  publishedCellsQueryStatus,
  aisleTopologyQueryStatus,
  faceAccessByFaceId,
  anchors,
  segments,
  obstacles,
  floorId,
  layoutVersionId,
  packageId,
  activeRouteMode,
  tenantId
}: {
  routeSteps: PlanningRouteStepDto[];
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
  publishedCellsById: Map<string, Cell>;
  publishedCellsQueryStatus: QueryStatus;
  aisleTopologyQueryStatus: QueryStatus;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;
  anchors: PickingRouteAnchor[];
  segments: SolvedRouteSegment[];
  obstacles: RouteObstacle[];
  floorId: string | null;
  layoutVersionId: string | null;
  packageId: string | null;
  activeRouteMode: string;
  tenantId?: string | null;
}): DetailedDiagnosticsPayload {
  const requiredCellIds = collectRequiredCellIds({ routeSteps, locationsById });
  const missingRequiredCellIds = requiredCellIds.filter(
    (cellId) => !publishedCellsById.has(cellId)
  );
  const resolvedAnchorCount = anchors.filter(
    (anchor) => anchor.status === 'resolved'
  ).length;
  const rackCount = obstacles.filter((obstacle) => obstacle.type === 'rack').length;

  return {
    build: {
      sha: import.meta.env.VITE_BUILD_SHA ?? 'unknown',
      timestamp: import.meta.env.VITE_BUILD_TIMESTAMP ?? 'unknown',
      mode: import.meta.env.MODE
    },
    scenario: {
      floorId,
      layoutVersionId,
      packageId,
      activeRouteMode,
      ...(tenantId !== undefined ? { tenantId } : {})
    },
    readiness: {
      publishedCellsQueryStatus,
      publishedCellsByIdSize: publishedCellsById.size,
      requiredCellIds,
      missingRequiredCellIds,
      aisleTopologyQueryStatus,
      faceAccessByFaceIdSize: faceAccessByFaceId?.size ?? 0,
      anchorCount: anchors.length,
      resolvedAnchorCount,
      unresolvedAnchorCount: anchors.length - resolvedAnchorCount
    },
    solverConfig: {
      gridCellSizeM: DEFAULT_GRID_ROUTE_SOLVER_CONFIG.resolutionM,
      obstaclePaddingM: DEFAULT_GRID_ROUTE_SOLVER_CONFIG.clearanceM,
      boundsMarginM: DEFAULT_GRID_ROUTE_SOLVER_CONFIG.boundsMarginM,
      maxEndpointSnapCells: DEFAULT_GRID_ROUTE_SOLVER_CONFIG.maxEndpointSnapCells
    },
    obstacles: {
      totalCount: obstacles.length,
      rackCount,
      wallCount: obstacles.length - rackCount,
      signature: buildObstacleSignature(obstacles)
    },
    anchors: {
      signature: buildAnchorSignature(anchors)
    },
    segments: segments.map((segment, index) => ({
      index,
      fromStepId: segment.fromStepId,
      toStepId: segment.toStepId,
      status: segment.status,
      skippedReason: segment.status === 'skipped' ? segment.reason : undefined,
      solverStatus:
        segment.status === 'unroutable' ? segment.solverStatus : undefined,
      debugReason:
        segment.status === 'unroutable'
          ? segment.debugReason
          : segment.status === 'skipped'
            ? segment.reason
            : segment.diagnostics?.debugReason,
      startCanvas:
        'fromCanvasPoint' in segment
          ? roundPoint(segment.fromCanvasPoint)
          : roundPoint(segment.diagnostics?.fromCanvasPoint),
      endCanvas:
        'toCanvasPoint' in segment
          ? roundPoint(segment.toCanvasPoint)
          : roundPoint(segment.diagnostics?.toCanvasPoint),
      startWorld: roundPoint(segment.diagnostics?.fromWorldPoint),
      endWorld: roundPoint(segment.diagnostics?.toWorldPoint),
      originalStartGridCell: segment.diagnostics?.originalStartCell ?? null,
      originalEndGridCell: segment.diagnostics?.originalEndCell ?? null,
      snappedStartGridCell: segment.diagnostics?.snappedStartCell ?? null,
      snappedEndGridCell: segment.diagnostics?.snappedEndCell ?? null,
      solverBounds: segment.diagnostics?.solverBounds ?? null,
      blockedCellCount: segment.diagnostics?.blockedGridCellCount ?? null,
      solvedPathPointCount:
        segment.status === 'ok'
          ? segment.canvasPoints.length
          : (segment.diagnostics?.pathWorldPoints.length ?? null)
    }))
  };
}

export function buildPickingRouteDebugSummary({
  routeSteps,
  locationsById,
  publishedCellsById,
  publishedCellsQueryStatus,
  aisleTopologyQueryStatus,
  faceAccessByFaceId,
  anchors,
  segments,
  detailedDiagnostics
}: {
  routeSteps: PlanningRouteStepDto[];
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
  publishedCellsById: Map<string, Cell>;
  publishedCellsQueryStatus: QueryStatus;
  aisleTopologyQueryStatus: QueryStatus;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;
  anchors: PickingRouteAnchor[];
  segments: SolvedRouteSegment[];
  detailedDiagnostics?: DetailedDiagnosticsPayload;
}): NonNullable<PickingRoutePerformanceSummary['debug']> {
  const requiredCellIds = collectRequiredCellIds({ routeSteps, locationsById });
  const anchorsResolvedCount = anchors.filter(
    (anchor) => anchor.status === 'resolved'
  ).length;

  return {
    ...(detailedDiagnostics ? { detailedDiagnostics } : {}),
    publishedCellsQueryStatus,
    publishedCellsByIdSize: publishedCellsById.size,
    requiredCellIdsCount: requiredCellIds.length,
    missingRequiredCellIds: requiredCellIds.filter(
      (cellId) => !publishedCellsById.has(cellId)
    ),
    aisleTopologyQueryStatus,
    faceAccessByFaceIdSize: faceAccessByFaceId?.size ?? 0,
    anchorsResolvedCount,
    anchorsUnresolvedCount: anchors.length - anchorsResolvedCount,
    segments: segments.map((segment) => ({
      fromStepId: segment.fromStepId,
      toStepId: segment.toStepId,
      status: segment.status,
      solverStatus:
        segment.status === 'unroutable'
          ? segment.solverStatus
          : segment.status === 'skipped'
            ? 'skipped'
            : undefined,
      debugReason:
        segment.status === 'unroutable'
          ? segment.debugReason
          : segment.status === 'skipped'
            ? segment.reason
            : undefined
    }))
  };
}
