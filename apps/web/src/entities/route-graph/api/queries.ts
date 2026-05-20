import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import type { RouteGraph } from '../model/types';

export const routeGraphKeys = {
  all: ['route-graph'] as const,
  byFloor: (floorId: string | null) =>
    [...routeGraphKeys.all, 'by-floor', floorId ?? 'none'] as const
};

export function getRouteGraph(floorId: string) {
  return bffRequest<RouteGraph>(`/api/floors/${floorId}/routing/graph`);
}

export function routeGraphQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: routeGraphKeys.byFloor(floorId),
    queryFn: () => getRouteGraph(floorId as string),
    enabled: floorId !== null
  });
}
