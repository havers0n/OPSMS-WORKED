import { describe, expect, it } from 'vitest';
import { resolveRouteComputationFlags } from './route-computation-scope';

describe('resolveRouteComputationFlags', () => {
  it('uses active-only in DEV when comparison debug is disabled', () => {
    const result = resolveRouteComputationFlags({
      activeMode: 'original',
      isDev: true,
      routeComparisonDebugEnabled: false
    });

    expect(result.scope).toBe('active-only');
    expect(result.shouldComputeComparisonRoutes).toBe(false);
    expect(result.shouldComputeNearestRoute).toBe(false);
    expect(result.shouldComputeNearestRouteCostRoute).toBe(false);
    expect(result.shouldComputeImprovedRouteCostRoute).toBe(false);
  });

  it('uses comparison in DEV when comparison debug is enabled', () => {
    const result = resolveRouteComputationFlags({
      activeMode: 'original',
      isDev: true,
      routeComparisonDebugEnabled: true
    });

    expect(result.scope).toBe('comparison');
    expect(result.shouldComputeComparisonRoutes).toBe(true);
    expect(result.shouldComputeNearestRoute).toBe(true);
    expect(result.shouldComputeNearestRouteCostRoute).toBe(true);
    expect(result.shouldComputeImprovedRouteCostRoute).toBe(true);
  });

  it('keeps production active-only regardless of debug flag', () => {
    const result = resolveRouteComputationFlags({
      activeMode: 'improved-route-cost',
      isDev: false,
      routeComparisonDebugEnabled: true
    });

    expect(result.scope).toBe('active-only');
    expect(result.shouldComputeComparisonRoutes).toBe(false);
    expect(result.shouldComputeNearestRoute).toBe(false);
    expect(result.shouldComputeNearestRouteCostRoute).toBe(false);
    expect(result.shouldComputeImprovedRouteCostRoute).toBe(true);
  });
});
