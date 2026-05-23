import { describe, expect, it } from 'vitest';
import { resolveRouteAutoComputePolicy } from './route-auto-compute-policy';

describe('resolveRouteAutoComputePolicy', () => {
  it('active-only default computes original + active only', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'nearest-route-cost',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: false,
      routeStepCount: 10,
      obstacleCount: 10
    });

    expect(result.scope).toBe('active-only');
    expect(result.computedModes).toEqual({
      original: true,
      nearest: false,
      nearestRouteCost: true,
      improved: false
    });
  });

  it('DEV comparison computes all modes', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: true,
      routeComparisonDebugEnabled: true,
      autoComputePolicyEnabled: false,
      routeStepCount: 50,
      obstacleCount: 999
    });

    expect(result.scope).toBe('comparison');
    expect(result.computedModes).toEqual({
      original: true,
      nearest: true,
      nearestRouteCost: true,
      improved: true
    });
  });

  it('small workload auto policy allows bounded extras', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 8,
      obstacleCount: 20
    });

    expect(result.computedModes).toEqual({
      original: true,
      nearest: true,
      nearestRouteCost: true,
      improved: true
    });
  });

  it('large workload suppresses route-cost and improved', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 24,
      obstacleCount: 20
    });

    expect(result.computedModes.nearestRouteCost).toBe(false);
    expect(result.computedModes.improved).toBe(false);
  });

  it('active mode is computed even if it exceeds extra thresholds', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'improved-route-cost',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 60,
      obstacleCount: 400
    });

    expect(result.computedModes.improved).toBe(true);
    expect(result.reasonsByMode.improved).toBe('active_mode');
  });

  it('improved is skipped when route step count > 12', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 13,
      obstacleCount: 10
    });

    expect(result.computedModes.improved).toBe(false);
    expect(result.reasonsByMode.improved).toBe('route_step_count_too_high');
  });

  it('route-cost is skipped when route step count > 16', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 17,
      obstacleCount: 10
    });

    expect(result.computedModes.nearestRouteCost).toBe(false);
    expect(result.reasonsByMode.nearestRouteCost).toBe(
      'route_step_count_too_high'
    );
  });

  it('obstacle threshold suppresses extras', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 8,
      obstacleCount: 121
    });

    expect(result.computedModes).toEqual({
      original: true,
      nearest: false,
      nearestRouteCost: false,
      improved: false
    });
    expect(result.reasonsByMode.nearest).toBe('obstacle_count_too_high');
  });

  it('reasons explain why modes were skipped', () => {
    const result = resolveRouteAutoComputePolicy({
      activeMode: 'original',
      isDev: false,
      routeComparisonDebugEnabled: false,
      autoComputePolicyEnabled: true,
      routeStepCount: 21,
      obstacleCount: 10
    });

    expect(result.reasonsByMode.nearest).toBe('route_step_count_too_high');
    expect(result.reasonsByMode.nearestRouteCost).toBe(
      'route_step_count_too_high'
    );
    expect(result.reasonsByMode.improved).toBe('route_step_count_too_high');
  });
});
