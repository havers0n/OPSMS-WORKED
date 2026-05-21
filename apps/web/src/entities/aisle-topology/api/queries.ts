import type { FloorAisleTopology } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const aisleTopologyKeys = {
  all: ['aisle-topology'] as const,
  byFloor: (floorId: string | null) =>
    [...aisleTopologyKeys.all, 'by-floor', floorId ?? 'none'] as const
};

export function getFloorAisleTopology(floorId: string) {
  return bffRequest<FloorAisleTopology>(`/api/floors/${floorId}/aisle-topology`);
}

export function floorAisleTopologyQueryOptions(
  floorId: string | null,
  enabled = true
) {
  return queryOptions({
    queryKey: aisleTopologyKeys.byFloor(floorId),
    queryFn: () => getFloorAisleTopology(floorId as string),
    enabled: enabled && Boolean(floorId)
  });
}
