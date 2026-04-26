import type { Cell, LayoutDraft } from '@wos/domain';
import {
  getCellCanvasRect,
  WORLD_SCALE
} from '@/entities/layout-version/lib/canvas-geometry';
import { getRouteStepId } from '@/entities/picking-planning/model/route-steps';
import type {
  PickingPlanningPreviewResponse,
  PlanningRouteStepDto
} from '@/entities/picking-planning/model/types';

export type PickingRouteAnchor =
  | {
      status: 'resolved';
      stepId: string;
      step: PlanningRouteStepDto;
      point: { x: number; y: number };
      source: 'cell' | 'projection';
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
};

function isFinitePoint(x: unknown, y: unknown): x is number {
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
}

export function resolveRouteStepAnchors({
  steps,
  locationsById,
  layout,
  publishedCellsById
}: ResolveRouteStepAnchorsParams): PickingRouteAnchor[] {
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

      const rect = getCellCanvasRect(rack, cell);
      if (!rect) {
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
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        },
        source: 'cell'
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
