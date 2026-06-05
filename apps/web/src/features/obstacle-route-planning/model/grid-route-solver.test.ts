import { describe, expect, it } from 'vitest';
import {
  inspectGridRouteEndpointCandidates,
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

const productionBounds = {
  minX: -1.5,
  minY: -5.5,
  maxX: 28.5,
  maxY: 40.5
} as const;

const productionConfig = {
  resolutionM: 0.5,
  clearanceM: 0.4,
  boundsMarginM: 5,
  maxEndpointSnapCells: 2
} as const;

const productionStart = { x: 7.3025, y: 31.109 };
const productionEnd = { x: 5.4125, y: 34.559 };

const productionAisleObstacles: RouteObstacle[] = [
  {
    type: 'rack',
    id: '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e',
    x: 4.94,
    y: 31.709,
    width: 17,
    height: 2.25
  },
  {
    type: 'rack',
    id: 'cf687ec8-116f-44e6-b3a7-e4ced604dea8',
    x: 4.113,
    y: 35.351,
    width: 18,
    height: 1
  }
];

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

  it('reproduces the production end_blocked aisle edge case with exact cells', () => {
    const result = solveGridRoute(
      productionStart,
      productionEnd,
      productionAisleObstacles,
      productionConfig,
      {
        includeDiagnostics: true,
        boundsOverride: productionBounds
      }
    );

    expect(result.status).toBe('end_blocked');
    expect(result.diagnostics).toMatchObject({
      originalStartCell: { x: 18, y: 73 },
      originalEndCell: { x: 14, y: 80 }
    });
    expect(result.diagnostics?.snappedStartCell).toBeUndefined();
    expect(result.diagnostics?.snappedEndCell).toBeUndefined();
  });

  it('inspects the production end candidates across snap radii', () => {
    const inspection = inspectGridRouteEndpointCandidates(
      productionStart,
      productionEnd,
      productionAisleObstacles,
      productionConfig,
      {
        endpoint: 'end',
        maxRadiusCells: 2,
        boundsOverride: productionBounds
      }
    );

    expect(inspection.originalCell).toEqual({ x: 14, y: 80 });
    expect(
      inspection.candidates.map(({ radius, cell, worldCenter, blockers }) => [
        radius,
        cell.x,
        cell.y,
        worldCenter.x,
        worldCenter.y,
        blockers[0]?.obstacleId ?? null,
        blockers[0]?.rule ?? null
      ])
    ).toEqual([
      [0, 14, 80, 5.5, 34.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [1, 13, 79, 5, 34, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [1, 13, 81, 5, 35, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [1, 14, 79, 5.5, 34, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [1, 14, 81, 5.5, 35, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [1, 15, 79, 6, 34, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [1, 15, 81, 6, 35, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [1, 13, 80, 5, 34.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [1, 15, 80, 6, 34.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [2, 12, 78, 4.5, 33.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [2, 12, 82, 4.5, 35.5, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 13, 78, 5, 33.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [2, 13, 82, 5, 35.5, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 14, 78, 5.5, 33.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [2, 14, 82, 5.5, 35.5, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 15, 78, 6, 33.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [2, 15, 82, 6, 35.5, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 16, 78, 6.5, 33.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [2, 16, 82, 6.5, 35.5, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 12, 79, 4.5, 34, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [2, 16, 79, 6.5, 34, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'center_in_inflated_obstacle'],
      [2, 12, 80, 4.5, 34.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [2, 16, 80, 6.5, 34.5, '38ec02bb-6d65-4d40-9a52-ffe7dadbfe3e', 'cell_area_intersects_inflated_obstacle'],
      [2, 12, 81, 4.5, 35, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle'],
      [2, 16, 81, 6.5, 35, 'cf687ec8-116f-44e6-b3a7-e4ced604dea8', 'center_in_inflated_obstacle']
    ]);
    expect(inspection.candidates.every((candidate) => candidate.blocked)).toBe(true);
    expect(inspection.candidates[0]?.blockers[0]?.overlapRect).toEqual({
      x: 5.25,
      y: 34.25,
      width: 0.5,
      height: 0.10900000000000176
    });
  });

  it('compares conservative and center-point occupancy for the production fixture', () => {
    const conservative = solveGridRoute(
      productionStart,
      productionEnd,
      productionAisleObstacles,
      productionConfig,
      {
        includeDiagnostics: true,
        boundsOverride: productionBounds
      }
    );
    const finerGrid = solveGridRoute(
      productionStart,
      productionEnd,
      productionAisleObstacles,
      {
        ...productionConfig,
        resolutionM: 0.25
      },
      {
        includeDiagnostics: true,
        boundsOverride: productionBounds
      }
    );
    const centerPoint = solveGridRoute(
      productionStart,
      productionEnd,
      productionAisleObstacles,
      productionConfig,
      {
        includeDiagnostics: true,
        boundsOverride: productionBounds,
        occupancyMode: 'center'
      }
    );

    expect({
      conservative: {
        status: conservative.status,
        blockedGridCellCount: conservative.diagnostics?.blockedGridCellCount ?? null,
        hasPath: conservative.status === 'ok'
      },
      finerGrid: {
        status: finerGrid.status,
        blockedGridCellCount: finerGrid.diagnostics?.blockedGridCellCount ?? null,
        hasPath: finerGrid.status === 'ok'
      },
      centerPoint: {
        status: centerPoint.status,
        blockedGridCellCount: centerPoint.diagnostics?.blockedGridCellCount ?? null,
        hasPath: centerPoint.status === 'ok'
      }
    }).toEqual({
      conservative: {
        status: 'end_blocked',
        blockedGridCellCount: 454,
        hasPath: false
      },
      finerGrid: {
        status: 'ok',
        blockedGridCellCount: 1544,
        hasPath: true
      },
      centerPoint: {
        status: 'ok',
        blockedGridCellCount: 362,
        hasPath: true
      }
    });
  });

  it('snaps a start endpoint when the point is clear but its grid cell is blocked', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 0.2,
      y: -0.25,
      width: 1,
      height: 0.5
    };
    const start = { x: -0.05, y: 0 };
    const end = { x: -2, y: 0 };

    const result = solveGridRoute(start, end, [rack], {
      clearanceM: 0.1,
      resolutionM: 0.5,
      maxEndpointSnapCells: 2
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.points[0]).toEqual(start);
    expect(result.points[result.points.length - 1]).toEqual(end);
    expect(result.debugReason).toContain('start_snap:');
    expectRouteClear(result.points, [rack], 0.1);
  });

  it('snaps an end endpoint when the point is clear but its grid cell is blocked', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 0.2,
      y: -0.25,
      width: 1,
      height: 0.5
    };
    const start = { x: -2, y: 0 };
    const end = { x: -0.05, y: 0 };

    const result = solveGridRoute(start, end, [rack], {
      clearanceM: 0.1,
      resolutionM: 0.5,
      maxEndpointSnapCells: 2
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.points[0]).toEqual(start);
    expect(result.points[result.points.length - 1]).toEqual(end);
    expect(result.debugReason).toContain('end_snap:');
    expectRouteClear(result.points, [rack], 0.1);
  });

  it('snaps both endpoints when nearby walkable cells exist', () => {
    const obstacles: RouteObstacle[] = [
      { type: 'rack', id: 'left', x: 0.2, y: -0.25, width: 1, height: 0.5 },
      { type: 'rack', id: 'right', x: 2.2, y: -0.25, width: 1, height: 0.5 }
    ];
    const start = { x: -0.05, y: 0 };
    const end = { x: 1.95, y: 0 };

    const result = solveGridRoute(start, end, obstacles, {
      clearanceM: 0.1,
      resolutionM: 0.5,
      maxEndpointSnapCells: 2
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.points[0]).toEqual(start);
    expect(result.points[result.points.length - 1]).toEqual(end);
    expect(result.debugReason).toContain('start_snap:');
    expect(result.debugReason).toContain('end_snap:');
    expectRouteClear(result.points, obstacles, 0.1);
  });

  it('returns start_blocked when no nearby walkable cell exists within snap radius', () => {
    const rack: RouteObstacle = {
      type: 'rack',
      id: 'rack-1',
      x: 0.2,
      y: -0.25,
      width: 1,
      height: 0.5
    };
    const result = solveGridRoute(
      { x: -0.05, y: 0 },
      { x: -2, y: 0 },
      [rack],
      { clearanceM: 0.1, resolutionM: 0.5, maxEndpointSnapCells: 0 }
    );

    expect(result.status).toBe('start_blocked');
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
