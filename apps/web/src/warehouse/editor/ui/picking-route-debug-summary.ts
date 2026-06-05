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

type QueryStatus = 'pending' | 'error' | 'success';

export function buildPickingRouteDebugSummary({
  routeSteps,
  locationsById,
  publishedCellsById,
  publishedCellsQueryStatus,
  aisleTopologyQueryStatus,
  faceAccessByFaceId,
  anchors,
  segments
}: {
  routeSteps: PlanningRouteStepDto[];
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
  publishedCellsById: Map<string, Cell>;
  publishedCellsQueryStatus: QueryStatus;
  aisleTopologyQueryStatus: QueryStatus;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;
  anchors: PickingRouteAnchor[];
  segments: SolvedRouteSegment[];
}): NonNullable<PickingRoutePerformanceSummary['debug']> {
  const requiredCellIds = new Set<string>();
  for (const step of routeSteps) {
    const locationId = step.fromLocationId;
    if (!locationId) continue;
    const cellId = locationsById?.[locationId]?.cellId;
    if (cellId) {
      requiredCellIds.add(cellId);
    }
  }

  const missingRequiredCellIds = [...requiredCellIds].filter(
    (cellId) => !publishedCellsById.has(cellId)
  );
  const anchorsResolvedCount = anchors.filter(
    (anchor) => anchor.status === 'resolved'
  ).length;

  return {
    publishedCellsQueryStatus,
    publishedCellsByIdSize: publishedCellsById.size,
    requiredCellIdsCount: requiredCellIds.size,
    missingRequiredCellIds,
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
