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
};

export type ContainerCurrentLocationRecord = {
  containerId: string;
  currentLocationId: string | null;
  locationCode: string | null;
  locationType: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer' | null;
  cellId: string | null;
};

export type LocationReadRepo = {
  locationExists(locationId: string): Promise<boolean>;
  listLocationContainers(locationId: string): Promise<LocationOccupancyRowRecord[]>;
  listCellContainers(cellId: string): Promise<LocationOccupancyRowRecord[]>;
  listFloorLocationOccupancy(floorId: string): Promise<LocationOccupancyRowRecord[]>;
  listLocationStorage(locationId: string): Promise<LocationStorageSnapshotRowRecord[]>;
  listCellStorage(cellId: string): Promise<LocationStorageSnapshotRowRecord[]>;
  getContainerCurrentLocation(containerId: string): Promise<ContainerCurrentLocationRecord | null>;
  containerExists(containerId: string): Promise<boolean>;
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

    async listLocationStorage(locationId) {
      const { data, error } = await supabase
        .from('location_storage_snapshot_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom')
        .eq('location_id', locationId)
        .order('placed_at', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationStorageSnapshotRowRecord[];
    },

    async listCellStorage(cellId) {
      const { data, error } = await supabase
        .from('location_storage_snapshot_v')
        .select('tenant_id,floor_id,location_id,location_code,location_type,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom')
        .eq('cell_id', cellId)
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
