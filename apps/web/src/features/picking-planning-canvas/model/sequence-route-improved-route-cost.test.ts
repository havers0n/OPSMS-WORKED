import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import type { PickingRouteAnchor } from './route-step-geometry';
import {
  sequencePickingRouteImprovedByRouteCost
} from './sequence-route-improved-route-cost';

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
    qtyEach: null,
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

function costForKey(key: string): number | null {
  const map: Record<string, number | null> = {
    '0,0->1,0': 1,
    '0,0->2,0': 5,
    '0,0->3,0': 6,
    '0,0->4,0': 7,
    '1,0->2,0': 1,
    '1,0->3,0': 8,
    '1,0->4,0': 9,
    '2,0->3,0': 1,
    '2,0->4,0': 2,
    '3,0->4,0': 100,
    '4,0->3,0': 1,
    // self edges
    '1,0->1,0': 0,
    '2,0->2,0': 0,
    '3,0->3,0': 0,
    '4,0->4,0': 0
  };
  return map[key] ?? 50;
}

describe('sequencePickingRouteImprovedByRouteCost', () => {
  beforeEach(() => {
    mockSolveGridRoute.mockReset();
  });

  it('improves a known bad seed order using 2-opt', () => {
    const anchors: PickingRouteAnchor[] = [
      resolved('a', 40, 0),
      resolved('b', 80, 0),
      resolved('c', 120, 0),
      resolved('d', 160, 0)
    ];

    mockSolveGridRoute.mockImplementation((start, end) => {
      const key = `${start.x},${start.y}->${end.x},${end.y}`;
      const cost = costForKey(key);
      if (cost === null) return { status: 'no_path', points: [], cost: 0 };
      return { status: 'ok', points: [], cost };
    });

    const result = sequencePickingRouteImprovedByRouteCost({
      anchors,
      obstacles: [],
      startCanvasPoint: { x: 0, y: 0 }
    });

    expect(result.orderedStepIds).toHaveLength(4);
    expect(new Set(result.orderedStepIds)).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(result.improvementCount).toBeGreaterThan(0);
    expect(result.converged).toBe(true);
  });

  it('keeps order unchanged when no strict improvement exists', () => {
    const anchors: PickingRouteAnchor[] = [
      resolved('a', 40, 0),
      resolved('b', 80, 0),
      resolved('c', 120, 0)
    ];

    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 1 });

    const result = sequencePickingRouteImprovedByRouteCost({
      anchors,
      obstacles: []
    });

    expect(result.improvementCount).toBe(0);
    expect(result.converged).toBe(true);
  });

  it('falls back when resolved anchors exceed guard', () => {
    const anchors: PickingRouteAnchor[] = Array.from({ length: 26 }, (_, index) =>
      resolved(`s-${index + 1}`, (index + 1) * 40, 0)
    );

    const result = sequencePickingRouteImprovedByRouteCost({
      anchors,
      obstacles: [],
      maxResolvedAnchorsForImproved: 25
    });

    expect(result.fallbackReason).toBe('too_many_resolved_anchors');
  });

  it('appends unresolved anchors safely and does not mutate input', () => {
    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 1 });
    const anchors: PickingRouteAnchor[] = [
      resolved('a', 40, 0),
      unresolved('u1'),
      resolved('b', 80, 0),
      unresolved('u2')
    ];
    const before = anchors.map((anchor) => anchor.stepId);

    const result = sequencePickingRouteImprovedByRouteCost({
      anchors,
      obstacles: []
    });

    expect(result.orderedStepIds.slice(-2)).toEqual(['u1', 'u2']);
    expect(anchors.map((anchor) => anchor.stepId)).toEqual(before);
  });

  it('stops deterministically when maxSwapEvaluations is reached', () => {
    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 1 });

    const result = sequencePickingRouteImprovedByRouteCost({
      anchors: [
        resolved('a', 40, 0),
        resolved('b', 80, 0),
        resolved('c', 120, 0),
        resolved('d', 160, 0)
      ],
      obstacles: [],
      maxIterations: 100,
      maxSwapEvaluations: 1
    });

    expect(result.converged).toBe(false);
    expect(result.iterationCount).toBe(1);
  });
});
