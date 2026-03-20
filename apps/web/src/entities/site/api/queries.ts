import type { Site } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const siteKeys = {
  all: ['site'] as const,
  list: () => [...siteKeys.all, 'list'] as const
};

async function fetchSites(): Promise<Site[]> {
  return bffRequest<Site[]>('/sites');
}

export function sitesQueryOptions() {
  return queryOptions({
    queryKey: siteKeys.list(),
    queryFn: fetchSites
  });
}
