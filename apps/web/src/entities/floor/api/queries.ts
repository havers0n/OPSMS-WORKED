import type { Floor } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/shared/api/supabase/client';
import { mapFloorRowToDomain, type FloorRow } from './mappers';

export const floorKeys = {
  all: ['floor'] as const,
  listBySite: (siteId: string | null) => [...floorKeys.all, 'list', siteId ?? 'none'] as const
};

async function fetchFloors(siteId: string): Promise<Floor[]> {
  const { data, error } = await supabase.from('floors').select('id,site_id,code,name,sort_order').eq('site_id', siteId).order('sort_order', { ascending: true });
  if (error) {
    throw error;
  }

  return ((data ?? []) as FloorRow[]).map(mapFloorRowToDomain);
}

export function floorsQueryOptions(siteId: string | null) {
  return queryOptions({
    queryKey: floorKeys.listBySite(siteId),
    queryFn: () => fetchFloors(siteId as string),
    enabled: Boolean(siteId)
  });
}
