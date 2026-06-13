import type { SupabaseClient } from '@supabase/supabase-js';

export type WarehouseLabelLocationRow = {
  id: string;
  tenant_id: string;
  floor_id: string;
  code: string;
  location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  geometry_slot_id: string | null;
  status: 'active' | 'disabled' | 'draft';
};

export type WarehouseLabelCellRow = {
  id: string;
  address_sort_key: string;
  status: 'active' | 'inactive';
  layout_version_id: string;
};

export type WarehouseLabelLayoutVersionRow = {
  id: string;
  floor_id: string;
  state: 'draft' | 'published' | 'archived';
};

type FloorTenantRow = {
  id: string;
  sites?: { tenant_id?: string | null } | { tenant_id?: string | null }[] | null;
};

const POSTGREST_ID_CHUNK_SIZE = 100;

function isVisibleFloorRow(row: FloorTenantRow | null, tenantId: string): boolean {
  if (!row) {
    return false;
  }

  const site = Array.isArray(row.sites) ? row.sites[0] : row.sites;
  return site?.tenant_id === tenantId;
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  if (ids.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }

  return chunks;
}

export type WarehouseLabelsRepo = {
  listTenantFloorRackSlotLocations(tenantId: string, floorId: string): Promise<WarehouseLabelLocationRow[]>;
  listTenantLocationsByIds(tenantId: string, locationIds: string[]): Promise<WarehouseLabelLocationRow[]>;
  listCellsByIds(cellIds: string[]): Promise<WarehouseLabelCellRow[]>;
  listPublishedLayoutVersionsForFloor(tenantId: string, floorId: string): Promise<WarehouseLabelLayoutVersionRow[]>;
};

export function createWarehouseLabelsRepo(supabase: SupabaseClient): WarehouseLabelsRepo {
  return {
    async listTenantFloorRackSlotLocations(tenantId, floorId) {
      const { data, error } = await supabase
        .from('locations')
        .select('id,tenant_id,floor_id,code,location_type,geometry_slot_id,status')
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .eq('location_type', 'rack_slot');

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseLabelLocationRow[];
    },

    async listTenantLocationsByIds(tenantId, locationIds) {
      if (locationIds.length === 0) {
        return [];
      }

      const chunks = chunkIds(locationIds, POSTGREST_ID_CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from('locations')
            .select('id,tenant_id,floor_id,code,location_type,geometry_slot_id,status')
            .eq('tenant_id', tenantId)
            .in('id', chunk);

          if (error) {
            throw error;
          }

          return (data ?? []) as WarehouseLabelLocationRow[];
        })
      );

      return chunkResults.flat();
    },

    async listCellsByIds(cellIds) {
      if (cellIds.length === 0) {
        return [];
      }

      const chunks = chunkIds(cellIds, POSTGREST_ID_CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from('cells')
            .select('id,address_sort_key,status,layout_version_id')
            .in('id', chunk);

          if (error) {
            throw error;
          }

          return (data ?? []) as WarehouseLabelCellRow[];
        })
      );

      return chunkResults.flat();
    },

    async listPublishedLayoutVersionsForFloor(tenantId, floorId) {
      const { data: floorRow, error: floorError } = await supabase
        .from('floors')
        .select('id,sites!inner(tenant_id)')
        .eq('id', floorId)
        .eq('sites.tenant_id', tenantId)
        .maybeSingle();

      if (floorError) {
        throw floorError;
      }

      if (!isVisibleFloorRow(floorRow as FloorTenantRow | null, tenantId)) {
        return [];
      }

      const { data, error } = await supabase
        .from('layout_versions')
        .select('id,floor_id,state')
        .eq('floor_id', floorId)
        .eq('state', 'published');

      if (error) {
        throw error;
      }

      return ((data ?? []) as WarehouseLabelLayoutVersionRow[]).map((row) => ({
        id: row.id,
        floor_id: row.floor_id,
        state: row.state
      }));
    }
  };
}
