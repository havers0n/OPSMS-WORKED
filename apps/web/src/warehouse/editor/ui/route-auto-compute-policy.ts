import type { PickingRouteOrderMode } from '@/entities/picking-planning/model/overlay-store';
import type { PickingRoutePerformanceSummary } from '@/entities/picking-planning/model/types';

export const ROUTE_AUTO_COMPUTE_LIMITS = {
  maxRouteStepsForNearestExtra: 20,
  maxRouteStepsForRouteCost: 16,
  maxRouteStepsForImproved: 12,
  maxObstacleCountForExtras: 120
} as const;

type ComputedModes = PickingRoutePerformanceSummary['computedModes'];
type Scope = PickingRoutePerformanceSummary['scope'];

export type RouteAutoComputePolicyResult = NonNullable<
  PickingRoutePerformanceSummary['policy']
>;

export type ResolveRouteAutoComputePolicyInput = {
  activeMode: PickingRouteOrderMode;
  isDev: boolean;
  routeComparisonDebugEnabled: boolean;
  autoComputePolicyEnabled: boolean;
  routeStepCount: number;
  obstacleCount: number;
};

function toScope(isComparisonEnabled: boolean): Scope {
  return isComparisonEnabled ? 'comparison' : 'active-only';
}

function activeModeToComputed(activeMode: PickingRouteOrderMode): ComputedModes {
  return {
    original: true,
    nearest: activeMode === 'nearest-neighbor',
    nearestRouteCost: activeMode === 'nearest-route-cost',
    improved: activeMode === 'improved-route-cost'
  };
}

export function resolveRouteAutoComputePolicy(
  input: ResolveRouteAutoComputePolicyInput
): RouteAutoComputePolicyResult {
  const shouldComputeComparisonRoutes =
    input.isDev && input.routeComparisonDebugEnabled;

  const computedModes = activeModeToComputed(input.activeMode);
  const reasonsByMode: RouteAutoComputePolicyResult['reasonsByMode'] = {
    original: 'always_computed',
    nearest: computedModes.nearest ? 'active_mode' : 'not_requested',
    nearestRouteCost: computedModes.nearestRouteCost
      ? 'active_mode'
      : 'not_requested',
    improved: computedModes.improved ? 'active_mode' : 'not_requested'
  };

  if (shouldComputeComparisonRoutes) {
    return {
      scope: toScope(true),
      autoSelected: false,
      autoComputePolicyEnabled: input.autoComputePolicyEnabled,
      computedModes: {
        original: true,
        nearest: true,
        nearestRouteCost: true,
        improved: true
      },
      reasonsByMode: {
        original: 'always_computed',
        nearest: 'dev_comparison_scope',
        nearestRouteCost: 'dev_comparison_scope',
        improved: 'dev_comparison_scope'
      },
      limits: ROUTE_AUTO_COMPUTE_LIMITS,
      inputs: {
        activeMode: input.activeMode,
        routeStepCount: input.routeStepCount,
        obstacleCount: input.obstacleCount,
        isDev: input.isDev,
        routeComparisonDebugEnabled: input.routeComparisonDebugEnabled
      }
    };
  }

  if (!input.autoComputePolicyEnabled) {
    return {
      scope: toScope(false),
      autoSelected: false,
      autoComputePolicyEnabled: false,
      computedModes,
      reasonsByMode,
      limits: ROUTE_AUTO_COMPUTE_LIMITS,
      inputs: {
        activeMode: input.activeMode,
        routeStepCount: input.routeStepCount,
        obstacleCount: input.obstacleCount,
        isDev: input.isDev,
        routeComparisonDebugEnabled: input.routeComparisonDebugEnabled
      }
    };
  }

  const extrasSuppressedByObstacles =
    input.obstacleCount > ROUTE_AUTO_COMPUTE_LIMITS.maxObstacleCountForExtras;

  if (extrasSuppressedByObstacles) {
    if (!computedModes.nearest) reasonsByMode.nearest = 'obstacle_count_too_high';
    if (!computedModes.nearestRouteCost) {
      reasonsByMode.nearestRouteCost = 'obstacle_count_too_high';
    }
    if (!computedModes.improved) reasonsByMode.improved = 'obstacle_count_too_high';
  } else if (
    !computedModes.nearest &&
    input.routeStepCount <= ROUTE_AUTO_COMPUTE_LIMITS.maxRouteStepsForNearestExtra
  ) {
    computedModes.nearest = true;
    reasonsByMode.nearest = 'auto_small_workload';
  } else if (!computedModes.nearest) {
    reasonsByMode.nearest = 'route_step_count_too_high';
  }

  if (!extrasSuppressedByObstacles) {
    if (
      !computedModes.nearestRouteCost &&
      input.routeStepCount <= ROUTE_AUTO_COMPUTE_LIMITS.maxRouteStepsForRouteCost
    ) {
      computedModes.nearestRouteCost = true;
      reasonsByMode.nearestRouteCost = 'auto_within_route_step_limit';
    } else if (!computedModes.nearestRouteCost) {
      reasonsByMode.nearestRouteCost = 'route_step_count_too_high';
    }

    if (
      !computedModes.improved &&
      input.routeStepCount <= ROUTE_AUTO_COMPUTE_LIMITS.maxRouteStepsForImproved
    ) {
      computedModes.improved = true;
      reasonsByMode.improved = 'auto_within_route_step_limit';
    } else if (!computedModes.improved) {
      reasonsByMode.improved = 'route_step_count_too_high';
    }
  }

  return {
    scope: toScope(false),
    autoSelected: false,
    autoComputePolicyEnabled: true,
    computedModes,
    reasonsByMode,
    limits: ROUTE_AUTO_COMPUTE_LIMITS,
    inputs: {
      activeMode: input.activeMode,
      routeStepCount: input.routeStepCount,
      obstacleCount: input.obstacleCount,
      isDev: input.isDev,
      routeComparisonDebugEnabled: input.routeComparisonDebugEnabled
    }
  };
}
