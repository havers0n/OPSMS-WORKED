import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ContainerNotFoundError,
  LocationNotActiveError,
  LocationNotFoundError,
  LocationOccupiedError
} from './errors.js';
import { isUuid } from './placement-validators.js';

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

type CellLayoutVersionRelation =
  | { floor_id?: string | null }
  | Array<{ floor_id?: string | null }>
  | null
  | undefined;

function extractFloorId(layoutVersions: CellLayoutVersionRelation) {
  if (Array.isArray(layoutVersions)) {
    return layoutVersions[0]?.floor_id ?? null;
  }

  return layoutVersions?.floor_id ?? null;
}

function mapPlacementRpcError(error: SupabaseLikeError): Error | null {
  if (error.code !== 'P0001') {
    return null;
  }

  switch (error.message) {
    case 'CONTAINER_NOT_FOUND':
      return new ContainerNotFoundError();
    case 'LOCATION_OCCUPIED':
      return new LocationOccupiedError();
    case 'LOCATION_NOT_ACTIVE':
      return new LocationNotActiveError();
    case 'LOCATION_NOT_FOUND':
      return new LocationNotFoundError();
    default:
      return null;
  }
}

export type ResolvedContainer = {
  id: string;
  externalCode: string | null;
};

export type ResolvedCell = {
  id: string;
  address: string;
  floorId: string;
};

export type ActivePlacement = {
  placementId: string;
  cellId: string;
};

export type ResolvedExecutableLocation = {
  locationId: string;
  code: string;
  floorId: string;
  cellId: string;
};

export type PlacementRepo = {
  resolveContainer(containerRef: string, tenantId: string): Promise<ResolvedContainer | null>;
  resolvePlaceTarget(targetCellRef: string): Promise<ResolvedCell | null>;
  resolveExecutableLocationForCell(cellId: string): Promise<ResolvedExecutableLocation | null>;
  getActivePlacement(containerId: string): Promise<ActivePlacement | null>;
  placeContainerAtLocation(containerId: string, locationId: string, actorId?: string | null): Promise<void>;
};

export function createPlacementRepo(supabase: SupabaseClient): PlacementRepo {
  return {
    async resolveContainer(containerRef, tenantId) {
      if (isUuid(containerRef)) {
        const { data, error } = await supabase
          .from('containers')
          .select('id,external_code')
          .eq('tenant_id', tenantId)
          .eq('id', containerRef)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          return {
            id: data.id,
            externalCode: data.external_code ?? null
          };
        }
      }

      const { data, error } = await supabase
        .from('containers')
        .select('id,external_code')
        .eq('tenant_id', tenantId)
        .eq('external_code', containerRef)
        .limit(2);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      return {
        id: data[0].id,
        externalCode: data[0].external_code ?? null
      };
    },

    async resolvePlaceTarget(targetCellRef) {
      if (!isUuid(targetCellRef)) {
        return null;
      }

      const { data, error } = await supabase
        .from('cells')
        .select('id,address,layout_versions!inner(floor_id)')
        .eq('id', targetCellRef)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const floorId = data ? extractFloorId(data.layout_versions as CellLayoutVersionRelation) : null;

      return data
        ? {
            id: data.id,
            address: data.address,
            floorId: floorId ?? ''
          }
        : null;
    },

    async resolveExecutableLocationForCell(cellId) {
      if (!isUuid(cellId)) {
        return null;
      }

      const { data, error } = await supabase
        .from('locations')
        .select('id,code,floor_id,geometry_slot_id')
        .eq('geometry_slot_id', cellId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data
        ? {
            locationId: data.id,
            code: data.code,
            floorId: data.floor_id,
            cellId: data.geometry_slot_id
          }
        : null;
    },

    async getActivePlacement(containerId) {
      const { data, error } = await supabase
        .from('container_placements')
        .select('id,cell_id')
        .eq('container_id', containerId)
        .is('removed_at', null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data
        ? {
            placementId: data.id,
            cellId: data.cell_id
          }
        : null;
    },

    async placeContainerAtLocation(containerId, locationId, actorId) {
      const { error } = await supabase.rpc('place_container_at_location', {
        container_uuid: containerId,
        location_uuid: locationId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapPlacementRpcError(error) ?? error;
      }
    }
  };
}
