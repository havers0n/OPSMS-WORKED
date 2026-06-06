import { describe, expect, it, vi } from 'vitest';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import type { RouteComputationFlags } from '@/warehouse/editor/ui/route-computation-scope';
import { resolveRouteAutoComputePolicy } from '@/warehouse/editor/ui/route-auto-compute-policy';
import { computePickingRoutes } from './compute-picking-routes';

vi.mock('@/features/obstacle-route-planning/model/grid-route-solver', () => ({
  solveGridRoute: vi.fn(() => ({
    status: 'ok',
    points: [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ],
    cost: 2
  }))
}));

function step(taskId: string, fromLocationId: string): PlanningRouteStepDto {
  return {
    sequence: 1,
    taskId,
    fromLocationId,
    skuId: `sku-${taskId}`,
    qtyToPick: 1,
    qtyEach: null,
    allocations: []
  };
}

function flags(
  overrides: Partial<RouteComputationFlags> = {}
): RouteComputationFlags {
  const policy = resolveRouteAutoComputePolicy({
    activeMode: 'original',
    isDev: true,
    routeComparisonDebugEnabled: false,
    autoComputePolicyEnabled: false,
    routeStepCount: routeSteps.length,
    obstacleCount: 0
  });
  return {
    scope: 'active-only',
    shouldComputeComparisonRoutes: false,
    shouldComputeNearestRoute: false,
    shouldComputeNearestRouteCostRoute: false,
    shouldComputeImprovedRouteCostRoute: false,
    policy,
    ...overrides
  };
}

const routeSteps = [step('task-1', 'loc-1'), step('task-2', 'loc-2')];
const locationsById = {
  'loc-1': { id: 'loc-1', x: 1, y: 1 },
  'loc-2': { id: 'loc-2', x: 2, y: 2 }
} as const;

describe('computePickingRoutes', () => {
  it('original active-only computes only original', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'original',
      routeComputationFlags: flags(),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.original.status).toBe('computed');
    expect(result.nearest.status).toBe('skipped');
    expect(result.nearestRouteCost.status).toBe('skipped');
    expect(result.improved.status).toBe('skipped');
    expect(result.routePerformanceSummary.computedModes).toEqual({
      original: true,
      nearest: false,
      nearestRouteCost: false,
      improved: false
    });
  });

  it('nearest active-only computes nearest mode', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'nearest-neighbor',
      routeComputationFlags: flags({ shouldComputeNearestRoute: true }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.nearest.status).toBe('computed');
    expect(result.active.mode).toBe('nearest');
    expect(result.routePerformanceSummary.computedModes.nearest).toBe(true);
  });

  it('route-cost active-only computes route-cost mode', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'nearest-route-cost',
      routeComputationFlags: flags({ shouldComputeNearestRouteCostRoute: true }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.nearestRouteCost.status).toBe('computed');
    expect(result.active.mode).toBe('nearestRouteCost');
    expect(result.routePerformanceSummary.computedModes.nearestRouteCost).toBe(true);
  });

  it('improved active-only computes improved mode', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'improved-route-cost',
      routeComputationFlags: flags({ shouldComputeImprovedRouteCostRoute: true }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.improved.status).toBe('computed');
    expect(result.active.mode).toBe('improved');
    expect(result.routePerformanceSummary.computedModes.improved).toBe(true);
  });

  it('DEV comparison scope computes all modes', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'original',
      routeComputationFlags: flags({
        scope: 'comparison',
        shouldComputeComparisonRoutes: true,
        shouldComputeNearestRoute: true,
        shouldComputeNearestRouteCostRoute: true,
        shouldComputeImprovedRouteCostRoute: true
      }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.nearest.status).toBe('computed');
    expect(result.nearestRouteCost.status).toBe('computed');
    expect(result.improved.status).toBe('computed');
    expect(result.routePerformanceSummary.scope).toBe('comparison');
  });

  it('skipped modes are represented as skipped union without fake arrays', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'original',
      routeComputationFlags: flags(),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.nearest.status).toBe('skipped');
    if (result.nearest.status !== 'skipped') return;
    expect('segments' in result.nearest).toBe(false);
    expect('anchors' in result.nearest).toBe(false);
    expect('stepIds' in result.nearest).toBe(false);
  });

  it('manual start creates __route_start__ segment but no fake task row id', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'original',
      routeComputationFlags: flags(),
      routeStartPoint: { x: 0, y: 0, source: 'manual' },
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.active.segments[0]).toMatchObject({
      fromStepId: '__route_start__'
    });
    if (result.original.status !== 'computed') return;
    expect(result.original.stepIds).not.toContain('__route_start__');
  });

  it('performance summary computed modes align with actual execution', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'nearest-neighbor',
      routeComputationFlags: flags({ shouldComputeNearestRoute: true }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    expect(result.routePerformanceSummary.computedModes).toEqual({
      original: true,
      nearest: true,
      nearestRouteCost: false,
      improved: false
    });
  });

  it('produces diagnostics consistently for every computed mode', () => {
    const result = computePickingRoutes({
      routeSteps,
      activeRouteOrderMode: 'original',
      routeComputationFlags: flags({
        scope: 'comparison',
        shouldComputeComparisonRoutes: true,
        shouldComputeNearestRoute: true,
        shouldComputeNearestRouteCostRoute: true,
        shouldComputeImprovedRouteCostRoute: true
      }),
      routeStartPoint: null,
      locationsById: locationsById as never,
      layout: null,
      publishedCellsById: new Map(),
      obstacles: []
    });

    if (result.original.status !== 'computed') return;
    expect(result.original.diagnostics.totalSegments).toBeGreaterThanOrEqual(1);
    if (result.nearest.status === 'computed') {
      expect(result.nearest.diagnostics.totalSegments).toBeGreaterThanOrEqual(1);
    }
    if (result.nearestRouteCost.status === 'computed') {
      expect(result.nearestRouteCost.diagnostics.totalSegments).toBeGreaterThanOrEqual(1);
    }
    if (result.improved.status === 'computed') {
      expect(result.improved.diagnostics.totalSegments).toBeGreaterThanOrEqual(1);
    }
    expect(result.routePerformanceSummary.routeDiagnosticsMs).toBeGreaterThanOrEqual(0);
  });
});
