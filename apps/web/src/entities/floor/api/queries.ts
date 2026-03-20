import type { Floor } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const floorKeys = {
  all: ['floor'] as const,
  listBySite: (siteId: string | null) => [...floorKeys.all, 'list', siteId ?? 'none'] as const
};

async function fetchFloors(siteId: string): Promise<Floor[]> {
  return bffRequest<Floor[]>(`/sites/${siteId}/floors`);
}

export function floorsQueryOptions(siteId: string | null) {
  return queryOptions({
    queryKey: floorKeys.listBySite(siteId),
    queryFn: () => fetchFloors(siteId as string),
    enabled: Boolean(siteId)
  });
}
