import { describe, expect, it } from 'vitest';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import { isRouteSegmentClear } from '@/features/obstacle-route-planning/model/grid-route-solver';
import type { PickingRouteAnchor } from './route-step-geometry';
import { solvePickingRoute } from './route-step-geometry';

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
  worldX: number,
  worldY: number
): Extract<PickingRouteAnchor, { status: 'resolved' }> {
  return {
    status: 'resolved',
    stepId,
    step: { ...step, taskId: stepId },
    point: { x: worldX * WORLD_SCALE, y: worldY * WORLD_SCALE },
    source: 'pick-point'
  };
}

function expectRouteClear(points: { x: number; y: number }[], obstacles: RouteObstacle[], clearanceM = 0.4) {
  for (let index = 1; index < points.length; index += 1) {
    expect(isRouteSegmentClear(points[index - 1]!, points[index]!, obstacles, clearanceM)).toBe(
      true
    );
  }
}

describe('solvePickingRoute (integration)', () => {
  it('returns ok near rack faces when endpoint cells require deblocking snaps', () => {
    const startAnchor = resolvedAnchor('s1', -0.05, 0);
    const endAnchor = resolvedAnchor('s2', -2, 0);
    const anchors: PickingRouteAnchor[] = [startAnchor, endAnchor];
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'rack-1', x: 0.2, y: -0.25, width: 1, height: 0.5 }
    ];

    const result = solvePickingRoute(anchors, obstacles, {
      clearanceM: 0.1,
      resolutionM: 0.5,
      maxEndpointSnapCells: 2
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('ok');
    if (result[0]?.status !== 'ok') return;
    expect(result[0].canvasPoints[0]).toEqual(startAnchor.point);
    expect(result[0].canvasPoints[result[0].canvasPoints.length - 1]).toEqual(
      endAnchor.point
    );
  });

  it('routes anchors on opposite sides of a long rack around a rack edge when a path exists', () => {
    const anchors: PickingRouteAnchor[] = [
      resolvedAnchor('s3', 10, -1),
      resolvedAnchor('s4', 10, 3)
    ];
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'long-rack', x: 0, y: 0, width: 20, height: 2 }
    ];

    const result = solvePickingRoute(anchors, obstacles, {
      clearanceM: 0.4,
      resolutionM: 0.5,
      boundsMarginM: 5
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('ok');
    if (result[0]?.status !== 'ok') return;

    const worldPoints = result[0].canvasPoints.map((point) => ({
      x: point.x / WORLD_SCALE,
      y: point.y / WORLD_SCALE
    }));

    expect(worldPoints[0]).toEqual({ x: 10, y: -1 });
    expect(worldPoints[worldPoints.length - 1]).toEqual({ x: 10, y: 3 });
    expect(worldPoints.some((point) => point.x < 0 || point.x > 20)).toBe(true);
    expectRouteClear(worldPoints, obstacles, 0.4);
  });
});
