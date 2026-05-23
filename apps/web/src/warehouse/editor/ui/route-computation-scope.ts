import type { PickingRouteOrderMode } from '@/entities/picking-planning/model/overlay-store';
import type { PickingRoutePerformanceSummary } from '@/entities/picking-planning/model/types';

export type RouteComputationFlags = {
  scope: PickingRoutePerformanceSummary['scope'];
  shouldComputeComparisonRoutes: boolean;
  shouldComputeNearestRoute: boolean;
  shouldComputeNearestRouteCostRoute: boolean;
  shouldComputeImprovedRouteCostRoute: boolean;
};

export function resolveRouteComputationFlags({
  activeMode,
  isDev,
  routeComparisonDebugEnabled
}: {
  activeMode: PickingRouteOrderMode;
  isDev: boolean;
  routeComparisonDebugEnabled: boolean;
}): RouteComputationFlags {
  const shouldComputeComparisonRoutes = isDev && routeComparisonDebugEnabled;
  const scope: PickingRoutePerformanceSummary['scope'] =
    shouldComputeComparisonRoutes ? 'comparison' : 'active-only';
  return {
    scope,
    shouldComputeComparisonRoutes,
    shouldComputeNearestRoute:
      shouldComputeComparisonRoutes || activeMode === 'nearest-neighbor',
    shouldComputeNearestRouteCostRoute:
      shouldComputeComparisonRoutes || activeMode === 'nearest-route-cost',
    shouldComputeImprovedRouteCostRoute:
      shouldComputeComparisonRoutes || activeMode === 'improved-route-cost'
  };
}
