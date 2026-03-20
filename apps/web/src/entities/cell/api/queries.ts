import type { Cell } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const cellKeys = {
  all: ['cell'] as const,
  publishedByFloor: (floorId: string | null) =>
    [...cellKeys.all, 'published-by-floor', floorId ?? 'none'] as const
};

async function fetchPublishedCells(floorId: string): Promise<Cell[]> {
  return bffRequest<Cell[]>(`/api/floors/${floorId}/published-cells`);
}

export function publishedCellsQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: cellKeys.publishedByFloor(floorId),
    queryFn: () => fetchPublishedCells(floorId as string),
    enabled: Boolean(floorId)
  });
}
