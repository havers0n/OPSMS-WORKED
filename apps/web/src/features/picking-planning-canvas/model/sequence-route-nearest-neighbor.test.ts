import { describe, expect, it } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import type { PickingRouteAnchor } from './route-step-geometry';
import { sequencePickingRouteNearestNeighbor } from './sequence-route-nearest-neighbor';

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

describe('sequencePickingRouteNearestNeighbor', () => {
  it('returns [] for empty anchors', () => {
    expect(sequencePickingRouteNearestNeighbor([])).toEqual([]);
  });

  it('returns original order for one anchor', () => {
    const anchors = [resolved('a', 0, 0)];
    expect(sequencePickingRouteNearestNeighbor(anchors)).toEqual(['a']);
  });

  it('returns original order for all unresolved anchors', () => {
    const anchors = [unresolved('a'), unresolved('b')];
    expect(sequencePickingRouteNearestNeighbor(anchors)).toEqual(['a', 'b']);
  });

  it('keeps first resolved anchor as route start', () => {
    const anchors = [
      unresolved('u1'),
      resolved('a', 5, 5),
      resolved('b', 6, 5),
      resolved('c', 7, 5)
    ];
    expect(sequencePickingRouteNearestNeighbor(anchors)[0]).toBe('a');
  });

  it('orders simple resolved points by nearest-neighbor', () => {
    const anchors = [
      resolved('a', 0, 0),
      resolved('b', 10, 0),
      resolved('c', 1, 0),
      resolved('d', 2, 0)
    ];

    expect(sequencePickingRouteNearestNeighbor(anchors)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('breaks ties deterministically by original index', () => {
    const anchors = [
      resolved('a', 0, 0),
      resolved('b', 1, 0),
      resolved('c', -1, 0)
    ];

    expect(sequencePickingRouteNearestNeighbor(anchors)).toEqual(['a', 'b', 'c']);
  });

  it('appends unresolved anchors at tail in original relative order', () => {
    const anchors = [
      resolved('a', 0, 0),
      unresolved('u1'),
      resolved('b', 1, 0),
      unresolved('u2')
    ];

    expect(sequencePickingRouteNearestNeighbor(anchors)).toEqual(['a', 'b', 'u1', 'u2']);
  });

  it('does not mutate input anchors array', () => {
    const anchors = [resolved('a', 0, 0), resolved('b', 1, 0)];
    const before = anchors.map((anchor) => anchor.stepId);

    sequencePickingRouteNearestNeighbor(anchors);

    expect(anchors.map((anchor) => anchor.stepId)).toEqual(before);
  });

  it('with start point chooses nearest resolved anchor as first pick', () => {
    const anchors = [
      resolved('a', 10, 10),
      resolved('b', 1, 1),
      resolved('c', 6, 6)
    ];

    expect(
      sequencePickingRouteNearestNeighbor(anchors, {
        startCanvasPoint: { x: 0, y: 0 }
      })
    ).toEqual(['b', 'c', 'a']);
  });

  it('with start point preserves deterministic tie-break by original index', () => {
    const anchors = [resolved('a', 1, 0), resolved('b', -1, 0), resolved('c', 5, 0)];

    expect(
      sequencePickingRouteNearestNeighbor(anchors, {
        startCanvasPoint: { x: 0, y: 0 }
      })
    ).toEqual(['a', 'b', 'c']);
  });
});
