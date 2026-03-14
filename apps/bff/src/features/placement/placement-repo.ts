import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ActivePlacementNotFoundError,
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  CrossFloorPlacementMoveNotAllowedError,
  PlacementSourceMismatchError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError,
  TargetCellSameAsSourceError
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
    case 'CONTAINER_ALREADY_PLACED':
      return new ContainerAlreadyPlacedError();
    case 'TARGET_CELL_NOT_FOUND':
      return new TargetCellNotFoundError();
    case 'TARGET_CELL_NOT_PUBLISHED':
      return new PublishedLayoutNotFoundError();
    case 'CONTAINER_NOT_PLACED':
      return new ActivePlacementNotFoundError();
    case 'PLACEMENT_SOURCE_MISMATCH':
      return new PlacementSourceMismatchError();
    case 'CONTAINER_ALREADY_IN_TARGET_CELL':
      return new TargetCellSameAsSourceError();
    case 'TARGET_CELL_CROSS_FLOOR_MOVE_NOT_ALLOWED':
      return new CrossFloorPlacementMoveNotAllowedError();
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

export type PlacementRepo = {
  resolveContainer(containerRef: string, tenantId: string): Promise<ResolvedContainer | null>;
  resolvePlaceTarget(targetCellRef: string): Promise<ResolvedCell | null>;
  resolveSourceCells(sourceCellRef: string): Promise<ResolvedCell[]>;
  getActivePlacement(containerId: string): Promise<ActivePlacement | null>;
  placeContainer(containerId: string, cellId: string, actorId?: string | null): Promise<void>;
  removeContainerFromCells(containerId: string, sourceCellIds: string[], actorId?: string | null): Promise<void>;
  moveContainerFromCell(
    containerId: string,
    sourceCellId: string,
    targetCellId: string,
    actorId?: string | null
  ): Promise<void>;
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

    async resolveSourceCells(sourceCellRef) {
      if (!isUuid(sourceCellRef)) {
        return [];
      }

      const { data, error } = await supabase
        .from('cells')
        .select('id,address,layout_versions!inner(floor_id)')
        .eq('id', sourceCellRef)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const floorId = data ? extractFloorId(data.layout_versions as CellLayoutVersionRelation) : null;

      return data
        ? [{
            id: data.id,
            address: data.address,
            floorId: floorId ?? ''
          }]
        : [];
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

    async placeContainer(containerId, cellId, actorId) {
      const { error } = await supabase.rpc('place_container', {
        container_uuid: containerId,
        cell_uuid: cellId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapPlacementRpcError(error) ?? error;
      }
    },

    async removeContainerFromCells(containerId, sourceCellIds, actorId) {
      const { error } = await supabase.rpc('remove_container_if_in_cells', {
        container_uuid: containerId,
        source_cell_uuids: sourceCellIds,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapPlacementRpcError(error) ?? error;
      }
    },

    async moveContainerFromCell(containerId, sourceCellId, targetCellId, actorId) {
      const { error } = await supabase.rpc('move_container_from_cell', {
        container_uuid: containerId,
        source_cell_uuid: sourceCellId,
        target_cell_uuid: targetCellId,
        actor_uuid: actorId ?? null
      });

      if (error) {
        throw mapPlacementRpcError(error) ?? error;
      }
    }
  };
}
