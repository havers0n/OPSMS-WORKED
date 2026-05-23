import type { PickingRouteOrderMode } from '@/entities/picking-planning/model/overlay-store';
import type { PickingRoutePerformanceSummary } from '@/entities/picking-planning/model/types';
import { resolveRouteAutoComputePolicy } from './route-auto-compute-policy';

export type RouteComputationFlags = {
  scope: PickingRoutePerformanceSummary['scope'];
  shouldComputeComparisonRoutes: boolean;
  shouldComputeNearestRoute: boolean;
  shouldComputeNearestRouteCostRoute: boolean;
  shouldComputeImprovedRouteCostRoute: boolean;
  policy: NonNullable<PickingRoutePerformanceSummary['policy']>;
};

export function resolveRouteComputationFlags({
  activeMode,
  isDev,
  routeComparisonDebugEnabled,
  routeStepCount,
  obstacleCount,
  autoComputePolicyEnabled
}: {
  activeMode: PickingRouteOrderMode;
  isDev: boolean;
  routeComparisonDebugEnabled: boolean;
  routeStepCount: number;
  obstacleCount: number;
  autoComputePolicyEnabled: boolean;
}): RouteComputationFlags {
  const policy = resolveRouteAutoComputePolicy({
    activeMode,
    isDev,
    routeComparisonDebugEnabled,
    autoComputePolicyEnabled,
    routeStepCount,
    obstacleCount
  });
  const shouldComputeComparisonRoutes = policy.scope === 'comparison';
  return {
    scope: policy.scope,
    shouldComputeComparisonRoutes,
    shouldComputeNearestRoute: policy.computedModes.nearest,
    shouldComputeNearestRouteCostRoute: policy.computedModes.nearestRouteCost,
    shouldComputeImprovedRouteCostRoute: policy.computedModes.improved,
    policy
  };
}
