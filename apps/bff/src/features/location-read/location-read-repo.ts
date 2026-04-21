import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../placement/placement-validators.js';

export type LocationOccupancyRowRecord = {
  tenant_id: string;
  floor_id: string;
  location_id: string;
  location_code: string;
  location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  cell_id: string | null;
  container_id: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
};

export type LocationStorageSnapshotRowRecord = LocationOccupancyRowRecord & {
  item_ref: string | null;
  product_id?: string | null;
  quantity: number | null;
  uom: string | null;
  inventory_status?: 'available' | 'reserved' | 'damaged' | 'hold' | null;
  packaging_state?: 'sealed' | 'opened' | 'loose' | null;
  product_packaging_level_id?: string | null;
  pack_count?: number | null;
};

export type ContainerCurrentLocationRecord = {
  containerId: string;
  currentLocationId: string | null;
  locationCode: string | null;
  locationType: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer' | null;
  cellId: string | null;
};

export type LocationReferenceRecord = {
  locationId: string;
  locationCode: string;
  locationType: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  cellId: string | null;
};

export type NonRackLocationRefRecord = {
  id: string;
  code: string;
  location_type: 'floor' | 'staging' | 'dock' | 'buffer';
  floor_x: number | null;
  floor_y: number | null;
  status: 'active' | 'disabled' | 'draft';
};

export type LocationReadRepo = {
  locationExists(locationId: string): Promise<boolean>;
  getLocationByCell(cellId: string): Promise<LocationReferenceRecord | null>;
  listLocationContainers(locationId: string): Promise<LocationOccupancyRowRecord[]>;
  listCellContainers(cellId: string): Promise<LocationOccupancyRowRecord[]>;
  listFloorLocationOccupancy(floorId: string): Promise<LocationOccupancyRowRecord[]>;
  listFloorNonRackLocations(floorId: string): Promise<NonRackLocationRefRecord[]>;
  listLocationStorage(locationId: string): Promise<LocationStorageSnapshotRowRecord[]>;
  listCellStorage(cellId: string): Promise<LocationStorageSnapshotRowRecord[]>;
  listCellStorageByIds(cellIds: string[]): Promise<LocationStorageSnapshotRowRecord[]>;
  getContainerCurrentLocation(containerId: string): Promise<ContainerCurrentLocationRecord | null>;
  containerExists(containerId: string): Promise<boolean>;
  updateLocationGeometry(locationId: string, floorX: number | null, floorY: number | null): Promise<NonRackLocationRefRecord | null>;
};

export function createLocationReadRepo(supabase: SupabaseClient): LocationReadRepo {
  return {
    async locationExists(locationId) {
      if (!isUuid(locationId)) {
        return false;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .eq('id', locationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    },

    async getLocationByCell(cellId) {
      if (!isUuid(cellId)) {
        return null;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('id,code,location_type,geometry_slot_id')
        .eq('geometry_slot_id', cellId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        locationId: data.id,
        locationCode: data.code,
        locationType: data.location_type,
        cellId: data.geometry_slot_id
      };
    },

    async listLocationContainers(locationId) {
      const { data, error } = await supabase
        .from('location_occupancy_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,external_code,container_type,container_status,placed_at')
        .eq('location_id', locationId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationOccupancyRowRecord[];
    },

    async listCellContainers(cellId) {
      const { data, error } = await supabase
        .from('location_occupancy_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,external_code,container_type,container_status,placed_at')
        .eq('cell_id', cellId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationOccupancyRowRecord[];
    },

    async listFloorLocationOccupancy(floorId) {
      const { data, error } = await supabase
        .from('location_occupancy_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,external_code,container_type,container_status,placed_at')
        .eq('floor_id', floorId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationOccupancyRowRecord[];
    },

    async listFloorNonRackLocations(floorId) {
      const { data, error } = await supabase
        .from('locations')
        .select('id,code,location_type,floor_x,floor_y,status')
        .eq('floor_id', floorId)
        .neq('location_type', 'rack_slot')
        .order('code', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as NonRackLocationRefRecord[];
    },

    async updateLocationGeometry(locationId, floorX, floorY) {
      const { data, error } = await supabase
        .from('locations')
        .update({ floor_x: floorX, floor_y: floorY })
        .eq('id', locationId)
        .neq('location_type', 'rack_slot')
        .select('id,code,location_type,floor_x,floor_y,status')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as NonRackLocationRefRecord | null;
    },

    async listLocationStorage(locationId) {
      const { data, error } = await supabase
        .from('location_storage_canonical_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,system_code,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom,inventory_status,packaging_state,product_packaging_level_id,pack_count')
        .eq('location_id', locationId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationStorageSnapshotRowRecord[];
    },

    async listCellStorage(cellId) {
      const { data, error } = await supabase
        .from('location_storage_canonical_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,system_code,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom,inventory_status,packaging_state,product_packaging_level_id,pack_count')
        .eq('cell_id', cellId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationStorageSnapshotRowRecord[];
    },

    async listCellStorageByIds(cellIds) {
      if (cellIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('location_storage_canonical_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,system_code,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom,inventory_status,packaging_state,product_packaging_level_id,pack_count')
        .in('cell_id', cellIds)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationStorageSnapshotRowRecord[];
    },

    async getContainerCurrentLocation(containerId) {
      const { data, error } = await supabase
        .from('active_container_locations_v')
        .select('container_id,location_id,location_code,location_type,cell_id')
        .eq('container_id', containerId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        containerId: data.container_id,
        currentLocationId: data.location_id,
        locationCode: data.location_code,
        locationType: data.location_type,
        cellId: data.cell_id
      };
    },

    async containerExists(containerId) {
      if (!isUuid(containerId)) {
        return false;
      }

      const { data, error } = await supabase
        .from('containers')
        .select('id')
        .eq('id', containerId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    }
  };
}
