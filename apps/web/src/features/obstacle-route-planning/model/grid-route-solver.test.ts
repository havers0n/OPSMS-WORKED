import { describe, expect, it } from 'vitest';
import {
  isRouteSegmentClear,
  solveGridRoute
} from './grid-route-solver';
import type { RouteObstacle, RoutePoint } from './obstacle-types';
import {
  removeRedundantCollinearPoints,
  simplifyRouteLineOfSight
} from './route-simplification';

function expectRouteClear(points: RoutePoint[], obstacles: RouteObstacle[], clearanceM = 0.1) {
  for (let index = 1; index < points.length; index += 1) {
    expect(
      isRouteSegmentClear(points[index - 1]!, points[index]!, obstacles, clearanceM)
    ).toBe(true);
  }
}

function minPointDistanceToRack(points: RoutePoint[], rack: Extract<RouteObstacle, { type: 'rack' }>) {
  return Math.min(
    ...points.map((point) => {
      const dx = Math.max(rack.x - point.x, 0, point.x - (rack.x + rack.width));
      const dy = Math.max(rack.y - point.y, 0, point.y - (rack.y + rack.height));
      return Math.hypot(dx, dy);
    })
  );
}

describe('solveGridRoute', () => {
  it('returns a minimal clear path without obstacles', () => {
    const result = solveGridRoute({ x: 0, y: 0 }, { x: 5, y: 0 }, []);

    expect(result.status).toBe('ok');
    expect(result.points).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 }
    ]);
    expect(result.cost).toBeCloseTo(5);
  });

  it('routes around a single inflated rack', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 2,
      y: -1,
      width: 2,
      height: 2
    };
    const result = solveGridRoute(
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      [rack],
      { clearanceM: 0.2 }
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expectRouteClear(result.points, [rack], 0.2);
    expect(result.points.some((point) => Math.abs(point.y) > 1.1)).toBe(true);
  });

  it('uses an available aisle gap between racks', () => {
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'bottom', x: 2, y: -3, width: 2, height: 1.6 },
      { type: 'rack', id: 'top', x: 2, y: 1.4, width: 2, height: 1.6 }
    ];
    const result = solveGridRoute(
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      obstacles,
      { clearanceM: 0.2 }
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expectRouteClear(result.points, obstacles, 0.2);
    expect(Math.max(...result.points.map((point) => Math.abs(point.y)))).toBeLessThan(1);
  });

  it('returns no_path when blocking walls enclose the start', () => {
    const obstacles: RouteObstacle[] = [
      { type: 'wall', id: 'north', x1: -1, y1: -1, x2: 1, y2: -1 },
      { type: 'wall', id: 'east', x1: 1, y1: -1, x2: 1, y2: 1 },
      { type: 'wall', id: 'south', x1: 1, y1: 1, x2: -1, y2: 1 },
      { type: 'wall', id: 'west', x1: -1, y1: 1, x2: -1, y2: -1 }
    ];

    const result = solveGridRoute({ x: 0, y: 0 }, { x: 3, y: 0 }, obstacles);

    expect(result).toMatchObject({ status: 'no_path', points: [], cost: 0 });
  });

  it('returns start_blocked when start is inside an inflated rack', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 1,
      y: 1,
      width: 2,
      height: 2
    };

    const result = solveGridRoute({ x: 1.1, y: 1.1 }, { x: 6, y: 6 }, [rack]);

    expect(result.status).toBe('start_blocked');
  });

  it('returns end_blocked when end is inside an inflated rack', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 1,
      y: 1,
      width: 2,
      height: 2
    };

    const result = solveGridRoute({ x: -2, y: -2 }, { x: 1.1, y: 1.1 }, [rack]);

    expect(result.status).toBe('end_blocked');
  });

  it('does not cross a blocking wall segment', () => {
    const wall: RouteObstacle = {
      type: 'wall',
      id: 'wall-1',
      x1: 2,
      y1: -1,
      x2: 2,
      y2: 1
    };

    const result = solveGridRoute({ x: 0, y: 0 }, { x: 4, y: 0 }, [wall]);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expectRouteClear(result.points, [wall]);
  });

  it('returns no_path with a debug reason when the inferred grid is too large', () => {
    const result = solveGridRoute(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      [],
      { resolutionM: 0.5, maxGridCells: 100 }
    );

    expect(result.status).toBe('no_path');
    expect(result.debugReason).toMatch(/^grid_guard:/);
  });

  it('larger rack clearance pushes route points farther from the rack body', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 2,
      y: -0.5,
      width: 2,
      height: 1
    };

    const tight = solveGridRoute(
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      [rack],
      { clearanceM: 0.1 }
    );
    const wide = solveGridRoute(
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      [rack],
      { clearanceM: 0.8 }
    );

    expect(tight.status).toBe('ok');
    expect(wide.status).toBe('ok');
    if (tight.status !== 'ok' || wide.status !== 'ok') return;
    expect(minPointDistanceToRack(wide.points, rack)).toBeGreaterThan(
      minPointDistanceToRack(tight.points, rack)
    );
  });

  it('does not allow diagonal corner cutting through blocked orthogonal cells', () => {
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'east', x: 0.19, y: -0.01, width: 0.02, height: 0.23 },
      { type: 'rack', id: 'south', x: -0.01, y: 0.19, width: 0.23, height: 0.02 }
    ];

    const result = solveGridRoute(
      { x: 0, y: 0 },
      { x: 0.4, y: 0.4 },
      obstacles,
      { clearanceM: 0.01, resolutionM: 0.2 }
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.points).not.toEqual([
      { x: 0, y: 0 },
      { x: 0.4, y: 0.4 }
    ]);
    expectRouteClear(result.points, obstacles, 0.01);
  });
});

describe('route simplification', () => {
  it('removes redundant collinear points', () => {
    expect(
      removeRedundantCollinearPoints([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 }
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 }
    ]);
  });

  it('does not simplify line-of-sight through inflated obstacles', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 1,
      y: -0.5,
      width: 1,
      height: 1
    };
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 }
    ];

    const simplified = simplifyRouteLineOfSight(points, [rack], 0.1, isRouteSegmentClear);

    expect(simplified).toContainEqual({ x: 3, y: 1 });
    expect(simplified).not.toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 }
    ]);
  });
});
