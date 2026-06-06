import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import type { PickingRouteAnchor } from './route-step-geometry';
import { buildRouteCostMatrix } from './route-cost-matrix';

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

describe('buildRouteCostMatrix', () => {
  beforeEach(() => {
    mockSolveGridRoute.mockReset();
  });

  it('computes finite costs for reachable directed pairs', () => {
    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 7 });

    const result = buildRouteCostMatrix({
      anchors: [resolved('a', 40, 0), resolved('b', 80, 0)],
      obstacles: []
    });

    expect(result.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(result.costs[0]?.[1]).toBe(7);
    expect(result.costs[1]?.[0]).toBe(7);
    expect(result.pairSolveCount).toBe(2);
    expect(result.unreachablePairCount).toBe(0);
  });

  it('represents unreachable pairs as Infinity and tracks count', () => {
    mockSolveGridRoute
      .mockReturnValueOnce({ status: 'ok', points: [], cost: 5 })
      .mockReturnValueOnce({ status: 'no_path', points: [], cost: 0 });

    const result = buildRouteCostMatrix({
      anchors: [resolved('a', 40, 0), resolved('b', 80, 0)],
      obstacles: []
    });

    expect(result.costs[0]?.[1]).toBe(5);
    expect(result.costs[1]?.[0]).toBe(Number.POSITIVE_INFINITY);
    expect(result.unreachablePairCount).toBe(1);
  });

  it('includes start node when startCanvasPoint exists', () => {
    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 3 });

    const result = buildRouteCostMatrix({
      anchors: [resolved('a', 40, 0), resolved('b', 80, 0)],
      obstacles: [],
      startCanvasPoint: { x: 0, y: 0 }
    });

    expect(result.nodes[0]?.id).toBe('__route_start__');
    expect(result.nodes).toHaveLength(3);
    expect(result.pairSolveCount).toBe(6);
  });

  it('does not mutate input anchors and excludes unresolved nodes', () => {
    mockSolveGridRoute.mockReturnValue({ status: 'ok', points: [], cost: 1 });

    const anchors = [resolved('a', 40, 0), unresolved('u1')];
    const before = anchors.map((anchor) => anchor.stepId);

    const result = buildRouteCostMatrix({
      anchors,
      obstacles: []
    });

    expect(anchors.map((anchor) => anchor.stepId)).toEqual(before);
    expect(result.nodes.map((node) => node.id)).toEqual(['a']);
  });
});
