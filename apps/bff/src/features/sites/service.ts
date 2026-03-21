import type { SupabaseClient } from '@supabase/supabase-js';
import type { Site, Floor } from '@wos/domain';
import { createSitesRepo } from './repo.js';

type CreateSiteInput = {
  tenantId: string;
  code: string;
  name: string;
  timezone: string;
};

export type SitesService = {
  listSites(): Promise<Site[]>;
  createSite(input: CreateSiteInput): Promise<string>;
  listFloors(siteId: string): Promise<Floor[]>;
};

export function createSitesService(supabase: SupabaseClient): SitesService {
  const repo = createSitesRepo(supabase);
  return {
    listSites: () => repo.listAll(),
    createSite: (input) => repo.create(input),
    listFloors: (siteId) => repo.listFloorsBySiteId(siteId)
  };
}
