import { describe, expect, it, vi } from 'vitest';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import type { PickingRouteAnchor } from './route-step-geometry';
import { solvePickingRoute } from './route-step-geometry';

vi.mock('@/features/obstacle-route-planning/model/grid-route-solver');

import { solveGridRoute } from '@/features/obstacle-route-planning/model/grid-route-solver';
const mockSolver = vi.mocked(solveGridRoute);

const step = {
  sequence: 1,
  taskId: 'task-1',
  fromLocationId: 'loc-1',
  skuId: 'sku-1',
  qtyToPick: 1,
  allocations: []
};

function resolvedAnchor(
  stepId: string,
  px: number,
  py: number
): Extract<PickingRouteAnchor, { status: 'resolved' }> {
  return {
    status: 'resolved',
    stepId,
    step: { ...step, taskId: stepId },
    point: { x: px, y: py },
    source: 'pick-point'
  };
}

function unresolvedAnchor(stepId: string): Extract<PickingRouteAnchor, { status: 'unresolved' }> {
  return {
    status: 'unresolved',
    stepId,
    step: { ...step, taskId: stepId },
    reason: 'missing-rack'
  };
}

describe('solvePickingRoute', () => {
  it('returns [] for 0 anchors', () => {
    expect(solvePickingRoute([], [])).toEqual([]);
  });

  it('returns [] for 1 anchor', () => {
    expect(solvePickingRoute([resolvedAnchor('a', 100, 200)], [])).toEqual([]);
  });

  it('returns ok segment with canvasPoints for a resolved pair', () => {
    mockSolver.mockReturnValueOnce({
      status: 'ok',
      points: [
        { x: 2, y: 5 },
        { x: 4, y: 5 }
      ],
      cost: 2
    });

    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('s1', 80, 200),
      resolvedAnchor('s2', 160, 200)
    ];
    const result = solvePickingRoute(anchors, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: 'ok',
      fromStepId: 's1',
      toStepId: 's2'
    });
    if (result[0]?.status !== 'ok') return;
    expect(result[0].costMetres).toBe(2);
    expect(result[0].canvasPoints).toEqual([
      { x: 2 * WORLD_SCALE, y: 5 * WORLD_SCALE },
      { x: 4 * WORLD_SCALE, y: 5 * WORLD_SCALE }
    ]);
  });

  it('converts canvas px to world metres before calling solver and world metres back to canvas px', () => {
    const capturedArgs: { x: number; y: number }[] = [];
    mockSolver.mockImplementationOnce((start, end) => {
      capturedArgs.push(start, end);
      return { status: 'ok', points: [start, end], cost: 1 };
    });

    const pxA = { x: 80, y: 200 };
    const pxB = { x: 160, y: 400 };
    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('a', pxA.x, pxA.y),
      resolvedAnchor('b', pxB.x, pxB.y)
    ];

    const result = solvePickingRoute(anchors, []);

    expect(capturedArgs[0]).toEqual({ x: pxA.x / WORLD_SCALE, y: pxA.y / WORLD_SCALE });
    expect(capturedArgs[1]).toEqual({ x: pxB.x / WORLD_SCALE, y: pxB.y / WORLD_SCALE });

    if (result[0]?.status !== 'ok') return;
    expect(result[0].canvasPoints[0]).toEqual(pxA);
    expect(result[0].canvasPoints[1]).toEqual(pxB);
  });

  it('does not call solver and returns skipped when an anchor is unresolved', () => {
    mockSolver.mockClear();

    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('s1', 80, 200),
      unresolvedAnchor('s2'),
      resolvedAnchor('s3', 160, 200)
    ];
    const result = solvePickingRoute(anchors, []);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      status: 'skipped',
      reason: 'unresolved_anchor',
      fromStepId: 's1',
      toStepId: 's2'
    });
    expect(result[1]).toMatchObject({
      status: 'skipped',
      reason: 'unresolved_anchor',
      fromStepId: 's2',
      toStepId: 's3'
    });
  });

  it('returns unroutable with solverStatus when solver reports a blocked endpoint', () => {
    mockSolver.mockReturnValueOnce({ status: 'end_blocked', points: [], cost: 0 });

    const fromPt = { x: 80, y: 200 };
    const toPt = { x: 160, y: 200 };
    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('s1', fromPt.x, fromPt.y),
      resolvedAnchor('s2', toPt.x, toPt.y)
    ];
    const result = solvePickingRoute(anchors, []);

    expect(result[0]).toMatchObject({
      status: 'unroutable',
      solverStatus: 'end_blocked',
      fromStepId: 's1',
      toStepId: 's2',
      fromCanvasPoint: fromPt,
      toCanvasPoint: toPt
    });
  });

  it('returns unroutable with debugReason when solver returns one', () => {
    mockSolver.mockReturnValueOnce({
      status: 'no_path',
      points: [],
      cost: 0,
      debugReason: 'grid_guard:300000'
    });

    const result = solvePickingRoute(
      [resolvedAnchor('a', 0, 0), resolvedAnchor('b', 400, 400)],
      []
    );

    expect(result[0]).toMatchObject({
      status: 'unroutable',
      solverStatus: 'no_path',
      debugReason: 'grid_guard:300000'
    });
  });

  it('skipped segment preserves the available canvas point when one anchor is unresolved', () => {
    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('s1', 80, 200),
      unresolvedAnchor('s2')
    ];
    const result = solvePickingRoute(anchors, []);

    expect(result[0]).toMatchObject({
      status: 'skipped',
      reason: 'unresolved_anchor',
      fromCanvasPoint: { x: 80, y: 200 },
      toCanvasPoint: undefined
    });
  });

  it('with startCanvasPoint adds a start-to-first-resolved segment', () => {
    mockSolver
      .mockReturnValueOnce({
        status: 'ok',
        points: [
          { x: 1, y: 1 },
          { x: 2, y: 2 }
        ],
        cost: 2
      })
      .mockReturnValueOnce({
        status: 'ok',
        points: [
          { x: 2, y: 2 },
          { x: 3, y: 2 }
        ],
        cost: 1
      });

    const result = solvePickingRoute(
      [resolvedAnchor('a', 160, 160), resolvedAnchor('b', 240, 160)],
      [],
      undefined,
      { startCanvasPoint: { x: 80, y: 80 } }
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      status: 'ok',
      fromStepId: '__route_start__',
      toStepId: 'a',
      costMetres: 2
    });
    expect(result[1]).toMatchObject({
      status: 'ok',
      fromStepId: 'a',
      toStepId: 'b',
      costMetres: 1
    });
  });

  it('with startCanvasPoint and no resolved anchors returns empty', () => {
    const result = solvePickingRoute(
      [unresolvedAnchor('a')],
      [],
      undefined,
      { startCanvasPoint: { x: 80, y: 80 } }
    );
    expect(result).toEqual([]);
  });
});
