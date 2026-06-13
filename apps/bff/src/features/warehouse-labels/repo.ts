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

      const { data, error } = await supabase
        .from('locations')
        .select('id,tenant_id,floor_id,code,location_type,geometry_slot_id,status')
        .eq('tenant_id', tenantId)
        .in('id', locationIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseLabelLocationRow[];
    },

    async listCellsByIds(cellIds) {
      if (cellIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('cells')
        .select('id,address_sort_key,status,layout_version_id')
        .in('id', cellIds);

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseLabelCellRow[];
    },

    async listPublishedLayoutVersionsForFloor(tenantId, floorId) {
      const { data, error } = await supabase
        .from('layout_versions')
        .select('id,floor_id,state,floors!inner(id,sites!inner(tenant_id))')
        .eq('floor_id', floorId)
        .eq('state', 'published')
        .eq('floors.sites.tenant_id', tenantId);

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<WarehouseLabelLayoutVersionRow & { floors?: unknown }>).map((row) => ({
        id: row.id,
        floor_id: row.floor_id,
        state: row.state
      }));
    }
  };
}
