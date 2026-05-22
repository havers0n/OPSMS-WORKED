import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import type { PickingRouteAnchor } from './route-step-geometry';
import {
  DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST,
  sequencePickingRouteNearestByRouteCost
} from './sequence-route-nearest-route-cost';

vi.mock('@/features/obstacle-route-planning/model/grid-route-solver');

import { solveGridRoute } from '@/features/obstacle-route-planning/model/grid-route-solver';

const mockSolveGridRoute = vi.mocked(solveGridRoute);

function step(taskId: string): PlanningRouteStepDto {
  return {
    sequence: 1,
    taskId,
    fromLocationId: `loc-${taskId}`,
    skuId: `sku-${taskId}`,
    qtyToPick: 1,
    allocations: []
  };
}

function resolved(stepId: string, x: number, y: number): PickingRouteAnchor {
  return {
    status: 'resolved',
    stepId,
    step: step(stepId),
    point: { x, y },
    source: 'projection'
  };
}

function unresolved(stepId: string): PickingRouteAnchor {
  return {
    status: 'unresolved',
    stepId,
    step: step(stepId),
    reason: 'missing-cell-id'
  };
}

describe('sequencePickingRouteNearestByRouteCost', () => {
  beforeEach(() => {
    mockSolveGridRoute.mockReset();
  });

  it('returns original ordering with fallback when resolved anchors exceed guard', () => {
    const anchors: PickingRouteAnchor[] = Array.from(
      { length: DEFAULT_MAX_RESOLVED_ANCHORS_FOR_ROUTE_COST + 1 },
      (_, index) => resolved(`s-${index + 1}`, index + 1, 0)
    );

    const result = sequencePickingRouteNearestByRouteCost(anchors, { obstacles: [] });

    expect(result.fallbackReason).toBe('too_many_resolved_anchors');
    expect(result.orderedStepIds).toEqual(anchors.map((anchor) => anchor.stepId));
    expect(result.pairSolveCount).toBe(0);
    expect(result.unreachablePairCount).toBe(0);
    expect(mockSolveGridRoute).not.toHaveBeenCalled();
  });

  it('uses route solver cost (not euclidean) and keeps unreachable resolved at tail', () => {
    const anchors: PickingRouteAnchor[] = [
      resolved('a', 0, 0),
      resolved('b', 100, 0),
      resolved('c', 200, 0),
      unresolved('u-1')
    ];

    mockSolveGridRoute.mockImplementation((start, end) => {
      const key = `${start.x},${start.y}->${end.x},${end.y}`;
      if (key === '0,0->2.5,0') return { status: 'ok', points: [], cost: 100 };
      if (key === '0,0->5,0') return { status: 'ok', points: [], cost: 10 };
      if (key === '5,0->2.5,0') return { status: 'no_path', points: [], cost: 0 };
      return { status: 'ok', points: [], cost: 1 };
    });

    const result = sequencePickingRouteNearestByRouteCost(anchors, { obstacles: [] });

    expect(result.orderedStepIds).toEqual(['a', 'c', 'b', 'u-1']);
    expect(result.isPartial).toBe(true);
    expect(result.unresolvedTransitionCount).toBe(1);
    expect(result.pairSolveCount).toBe(3);
    expect(result.unreachablePairCount).toBe(1);
  });

  it('with start point picks cheapest reachable first anchor by route cost', () => {
    const anchors: PickingRouteAnchor[] = [
      resolved('a', 80, 0),
      resolved('b', 160, 0),
      resolved('c', 240, 0)
    ];

    mockSolveGridRoute.mockImplementation((start, end) => {
      const key = `${start.x},${start.y}->${end.x},${end.y}`;
      if (key === '0,0->1,0') return { status: 'ok', points: [], cost: 50 };
      if (key === '0,0->2,0') return { status: 'ok', points: [], cost: 5 };
      if (key === '0,0->3,0') return { status: 'end_blocked', points: [], cost: 0 };
      if (key === '2,0->1,0') return { status: 'ok', points: [], cost: 2 };
      if (key === '1,0->3,0') return { status: 'ok', points: [], cost: 2 };
      return { status: 'ok', points: [], cost: 1 };
    });

    const result = sequencePickingRouteNearestByRouteCost(anchors, {
      obstacles: [],
      startCanvasPoint: { x: 0, y: 0 }
    });

    expect(result.orderedStepIds).toEqual(['b', 'a', 'c']);
    expect(result.isPartial).toBe(false);
    expect(result.pairSolveCount).toBe(6);
    expect(result.unreachablePairCount).toBe(0);
  });
});
