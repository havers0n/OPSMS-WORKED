import { describe, expect, it } from 'vitest';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
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
});
