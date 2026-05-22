import type { Cell, LayoutDraft } from '@wos/domain';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import { getRouteStepId } from '@/entities/picking-planning/model/route-steps';
import type {
  PickingPlanningPreviewResponse,
  PlanningRouteStepDto
} from '@/entities/picking-planning/model/types';
import { solveGridRoute } from '@/features/obstacle-route-planning/model/grid-route-solver';
import type {
  GridRouteSolverConfig,
  RouteObstacle
} from '@/features/obstacle-route-planning/model/obstacle-types';
import { resolvePickPoint } from '@/features/pick-point-resolver/model/pick-point-resolver';
import type { FaceAccessLike } from '@/features/pick-point-resolver/model/pick-point-types';

export type PickingRouteAnchor =
  | {
      status: 'resolved';
      stepId: string;
      step: PlanningRouteStepDto;
      point: { x: number; y: number };
      source: 'pick-point' | 'projection';
    }
  | {
      status: 'unresolved';
      stepId: string;
      step: PlanningRouteStepDto;
      reason:
        | 'missing-step'
        | 'missing-location-projection'
        | 'missing-cell-id'
        | 'missing-published-cell'
        | 'missing-rack'
        | 'invalid-cell-geometry'
        | 'invalid-projection-geometry';
    };

type ResolveRouteStepAnchorsParams = {
  steps: PlanningRouteStepDto[];
  locationsById: PickingPlanningPreviewResponse['locationsById'] | undefined;
  layout: LayoutDraft | null;
  publishedCellsById: Map<string, Cell>;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;
};

function isFinitePoint(x: unknown, y: unknown): x is number {
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
}

export function resolveRouteStepAnchors({
  steps,
  locationsById,
  layout,
  publishedCellsById,
  faceAccessByFaceId
}: ResolveRouteStepAnchorsParams): PickingRouteAnchor[] {
  const racksById = new Map(Object.entries(layout?.racks ?? {}));
  const facesById = new Map(
    [...racksById.values()].flatMap((rack) =>
      rack.faces.map((face) => [face.id, face] as const)
    )
  );

  return steps.map((step) => {
    const stepId = getRouteStepId(step);
    if (!step?.fromLocationId) {
      return { status: 'unresolved', stepId, step, reason: 'missing-step' };
    }

    const location = locationsById?.[step.fromLocationId];
    if (!location) {
      return {
        status: 'unresolved',
        stepId,
        step,
        reason: 'missing-location-projection'
      };
    }

    if (location.cellId) {
      const cell = publishedCellsById.get(location.cellId);
      if (!cell) {
        return {
          status: 'unresolved',
          stepId,
          step,
          reason: 'missing-published-cell'
        };
      }

      const rack = layout?.racks[cell.rackId] ?? null;
      if (!rack) {
        return { status: 'unresolved', stepId, step, reason: 'missing-rack' };
      }

      const pickPoint = resolvePickPoint({
        location: {
          id: location.id,
          cellId: location.cellId,
          geometrySlotId: location.cellId,
          floorX: location.x ?? null,
          floorY: location.y ?? null
        },
        cellsById: publishedCellsById,
        racksById,
        facesById,
        faceAccessByFaceId
      });

      if (pickPoint.status !== 'ok') {
        return {
          status: 'unresolved',
          stepId,
          step,
          reason: 'invalid-cell-geometry'
        };
      }

      return {
        status: 'resolved',
        stepId,
        step,
        point: {
          x: pickPoint.pickPoint.x * WORLD_SCALE,
          y: pickPoint.pickPoint.y * WORLD_SCALE
        },
        source: 'pick-point'
      };
    }

    if (isFinitePoint(location.x, location.y)) {
      const y = location.y as number;
      return {
        status: 'resolved',
        stepId,
        step,
        point: {
          x: location.x * WORLD_SCALE,
          y: y * WORLD_SCALE
        },
        source: 'projection'
      };
    }

    if (location.x !== undefined || location.y !== undefined) {
      return {
        status: 'unresolved',
        stepId,
        step,
        reason: 'invalid-projection-geometry'
      };
    }

    return {
      status: 'unresolved',
      stepId,
      step,
      reason: 'missing-cell-id'
    };
  });
}

export function indexRouteAnchorStatus(anchors: PickingRouteAnchor[]) {
  return Object.fromEntries(
    anchors.map((anchor) => [
      anchor.stepId,
      anchor.status === 'resolved'
        ? { status: 'resolved' as const }
        : { status: 'unresolved' as const, reason: anchor.reason }
    ])
  );
}

export type SolvedRouteSegment =
  | {
      status: 'ok';
      fromStepId: string;
      toStepId: string;
      canvasPoints: { x: number; y: number }[];
      costMetres: number;
    }
  | {
      // Solver was never called — one or both anchors could not be resolved.
      status: 'skipped';
      reason: 'unresolved_anchor';
      fromStepId: string;
      toStepId: string;
      fromCanvasPoint: { x: number; y: number } | undefined;
      toCanvasPoint: { x: number; y: number } | undefined;
    }
  | {
      // Solver was called but returned a non-ok status.
      status: 'unroutable';
      solverStatus: 'no_path' | 'start_blocked' | 'end_blocked';
      debugReason?: string;
      fromStepId: string;
      toStepId: string;
      fromCanvasPoint: { x: number; y: number };
      toCanvasPoint: { x: number; y: number };
    };

export function solvePickingRoute(
  anchors: PickingRouteAnchor[],
  obstacles: RouteObstacle[],
  config?: GridRouteSolverConfig,
  options?: { startCanvasPoint?: { x: number; y: number } }
): SolvedRouteSegment[] {
  const resolvedAnchors = anchors.filter(
    (
      anchor
    ): anchor is Extract<PickingRouteAnchor, { status: 'resolved' }> =>
      anchor.status === 'resolved'
  );
  const startCanvasPoint = options?.startCanvasPoint;
  const startSegment: SolvedRouteSegment[] = [];

  if (startCanvasPoint && resolvedAnchors.length > 0) {
    const first = resolvedAnchors[0]!;
    const startWorld = {
      x: startCanvasPoint.x / WORLD_SCALE,
      y: startCanvasPoint.y / WORLD_SCALE
    };
    const endWorld = {
      x: first.point.x / WORLD_SCALE,
      y: first.point.y / WORLD_SCALE
    };
    const result = solveGridRoute(startWorld, endWorld, obstacles, config);

    if (result.status !== 'ok') {
      startSegment.push({
        status: 'unroutable',
        solverStatus: result.status,
        debugReason: result.debugReason,
        fromStepId: '__route_start__',
        toStepId: first.stepId,
        fromCanvasPoint: startCanvasPoint,
        toCanvasPoint: first.point
      });
    } else {
      startSegment.push({
        status: 'ok',
        fromStepId: '__route_start__',
        toStepId: first.stepId,
        costMetres: result.cost,
        canvasPoints: result.points.map((p) => ({
          x: p.x * WORLD_SCALE,
          y: p.y * WORLD_SCALE
        }))
      });
    }
  }

  if (anchors.length < 2) return startSegment;

  const segments = anchors.slice(1).map((anchor, index) => {
    const previous = anchors[index]!;

    if (previous.status !== 'resolved' || anchor.status !== 'resolved') {
      return {
        status: 'skipped' as const,
        reason: 'unresolved_anchor' as const,
        fromStepId: previous.stepId,
        toStepId: anchor.stepId,
        fromCanvasPoint: previous.status === 'resolved' ? previous.point : undefined,
        toCanvasPoint: anchor.status === 'resolved' ? anchor.point : undefined
      };
    }

    const startWorld = {
      x: previous.point.x / WORLD_SCALE,
      y: previous.point.y / WORLD_SCALE
    };
    const endWorld = {
      x: anchor.point.x / WORLD_SCALE,
      y: anchor.point.y / WORLD_SCALE
    };

    const result = solveGridRoute(startWorld, endWorld, obstacles, config);

    if (result.status !== 'ok') {
      return {
        status: 'unroutable' as const,
        solverStatus: result.status,
        debugReason: result.debugReason,
        fromStepId: previous.stepId,
        toStepId: anchor.stepId,
        fromCanvasPoint: previous.point,
        toCanvasPoint: anchor.point
      };
    }

    return {
      status: 'ok' as const,
      fromStepId: previous.stepId,
      toStepId: anchor.stepId,
      costMetres: result.cost,
      canvasPoints: result.points.map((p) => ({
        x: p.x * WORLD_SCALE,
        y: p.y * WORLD_SCALE
      }))
    };
  });

  return [...startSegment, ...segments];
}
