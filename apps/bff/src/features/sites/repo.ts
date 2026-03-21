import type { SupabaseClient } from '@supabase/supabase-js';
import type { Site, Floor } from '@wos/domain';
import { mapSiteRowToDomain, mapFloorRowToDomain } from '../../mappers.js';

type SiteRow = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

type FloorRow = {
  id: string;
  site_id: string;
  code: string;
  name: string;
  sort_order: number;
};

type CreateSiteInput = {
  tenantId: string;
  code: string;
  name: string;
  timezone: string;
};

export type SitesRepo = {
  listAll(): Promise<Site[]>;
  create(input: CreateSiteInput): Promise<string>;
  listFloorsBySiteId(siteId: string): Promise<Floor[]>;
};

export function createSitesRepo(supabase: SupabaseClient): SitesRepo {
  return {
    async listAll() {
      const { data, error } = await supabase
        .from('sites')
        .select('id,code,name,timezone')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as SiteRow[]).map(mapSiteRowToDomain);
    },

    async create(input) {
      const { data, error } = await supabase
        .from('sites')
        .insert({ tenant_id: input.tenantId, code: input.code, name: input.name, timezone: input.timezone })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return (data as { id: string }).id;
    },

    async listFloorsBySiteId(siteId) {
      const { data, error } = await supabase
        .from('floors')
        .select('id,site_id,code,name,sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as FloorRow[]).map(mapFloorRowToDomain);
    }
  };
}
