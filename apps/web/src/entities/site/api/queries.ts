import type { Site } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/shared/api/supabase/client';
import { mapSiteRowToDomain, type SiteRow } from './mappers';

export const siteKeys = {
  all: ['site'] as const,
  list: () => [...siteKeys.all, 'list'] as const
};

async function fetchSites(): Promise<Site[]> {
  const { data, error } = await supabase.from('sites').select('id,code,name,timezone').order('name', { ascending: true });
  if (error) {
    throw error;
  }

  return ((data ?? []) as SiteRow[]).map(mapSiteRowToDomain);
}

export function sitesQueryOptions() {
  return queryOptions({
    queryKey: siteKeys.list(),
    queryFn: fetchSites
  });
}
