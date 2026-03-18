import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply } from 'fastify';
import type { CellStorageSnapshotRow, FloorCellOccupancyRow } from '@wos/domain';
import { ApiError } from '../../errors.js';
import {
  attachProductsToRows,
  type ProductAwareRow
} from '../../inventory-product-resolution.js';
import {
  mapCellStorageSnapshotRowToDomain
} from '../../mappers.js';
import type {
  ExecutionService
} from '../execution/service.js';
import {
  ExecutionContainerNotFoundError,
  ExecutionContainerNotPlacedError,
  ExecutionTargetLocationDimensionOverflowError,
  ExecutionTargetLocationDimensionUnknownError,
  ExecutionTargetLocationSameAsSourceError,
  ExecutionTargetLocationNotActiveError,
  ExecutionTargetLocationNotFoundError,
  ExecutionTargetLocationOccupiedError,
  ExecutionTargetLocationTenantMismatchError,
  ExecutionTargetLocationWeightOverflowError,
  ExecutionTargetLocationWeightUnknownError
} from '../execution/errors.js';
import type {
  LocationReadRepo,
  LocationStorageSnapshotRowRecord
} from '../location-read/location-read-repo.js';
import type { PlacementRepo } from '../placement/placement-repo.js';

const LEGACY_ROUTE_METADATA = {
  floorCellOccupancy: {
    routeId: 'GET /api/floors/:floorId/cell-occupancy',
    replacement: '/api/floors/:floorId/location-occupancy'
  },
  rackSectionSlotStorage: {
    routeId: 'GET /api/rack-sections/:sectionId/slots/:slotNo/storage',
    replacement: '/api/locations/by-cell/:cellId + /api/locations/:locationId/storage'
  },
  containerPlaceByCell: {
    routeId: 'POST /api/containers/:containerId/place',
    replacement: '/api/placement/place-at-location'
  },
  containerMoveByCell: {
    routeId: 'POST /api/containers/:containerId/move',
    replacement: '/api/containers/:containerId/move-to-location'
  }
} as const;

type LegacyRouteKey = keyof typeof LEGACY_ROUTE_METADATA;

type CellSlotStorageData = {
  published: boolean;
  rows: CellStorageSnapshotRow[];
};

type LegacyMoveContainerResult = {
  action: 'moved';
  containerId: string;
  fromCellId: string;
  toCellId: string;
  previousPlacementId: string;
  placementId: string;
  occurredAt: string;
};

type LegacyExecutionGatewayDeps = {
  supabase: SupabaseClient;
  locationReadRepo: LocationReadRepo;
  placementRepo: PlacementRepo;
  executionService: ExecutionService;
};

function setDeprecatedHeaders(reply: FastifyReply, routeKey: LegacyRouteKey) {
  const metadata = LEGACY_ROUTE_METADATA[routeKey];
  reply.header('Deprecation', 'true');
  reply.header('Warning', `299 - "${metadata.routeId} is deprecated; use ${metadata.replacement}"`);
  reply.header('Link', `<${metadata.replacement}>; rel="successor-version"`);
}

function mapLegacyCellMoveError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is not currently placed.');
  }

  if (error instanceof ExecutionTargetLocationNotFoundError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell was not found.');
  }

  if (error instanceof ExecutionTargetLocationTenantMismatchError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetLocationNotActiveError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell is not currently writable.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is already in the target cell.');
  }

  if (error instanceof ExecutionTargetLocationOccupiedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Target cell already contains another active container.');
  }

  if (error instanceof ExecutionTargetLocationDimensionUnknownError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell fit cannot be verified because container dimensions are missing.');
  }

  if (error instanceof ExecutionTargetLocationDimensionOverflowError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Container dimensions exceed the target cell capacity.');
  }

  if (error instanceof ExecutionTargetLocationWeightUnknownError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell load cannot be verified because weight data is incomplete.');
  }

  if (error instanceof ExecutionTargetLocationWeightOverflowError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Container load exceeds the target cell capacity.');
  }

  return null;
}

async function attachProductsToCellStorageRows(
  supabase: SupabaseClient,
  rows: LocationStorageSnapshotRowRecord[]
) {
  return attachProductsToRows(
    supabase,
    rows as Array<
      ProductAwareRow & {
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
        quantity: number | null;
        uom: string | null;
      }
    >
  );
}

export type LegacyExecutionGateway = {
  applyDeprecationHeaders(reply: FastifyReply, routeKey: LegacyRouteKey): void;
  listFloorCellOccupancy(floorId: string): Promise<FloorCellOccupancyRow[]>;
  getRackSectionSlotStorage(sectionId: string, slotNo: number): Promise<CellSlotStorageData>;
  moveContainerByCell(command: {
    containerId: string;
    targetCellId: string;
    actorId?: string | null;
  }): Promise<LegacyMoveContainerResult>;
};

export function createLegacyExecutionGateway(
  deps: LegacyExecutionGatewayDeps
): LegacyExecutionGateway {
  return {
    applyDeprecationHeaders(reply, routeKey) {
      setDeprecatedHeaders(reply, routeKey);
    },

    async listFloorCellOccupancy(floorId) {
      const occupancyRows = await deps.locationReadRepo.listFloorLocationOccupancy(floorId);
      const countsByCellId = new Map<string, number>();

      for (const row of occupancyRows) {
        if (!row.cell_id) {
          continue;
        }

        countsByCellId.set(row.cell_id, (countsByCellId.get(row.cell_id) ?? 0) + 1);
      }

      return Array.from(countsByCellId.entries())
        .sort(([leftCellId], [rightCellId]) => leftCellId.localeCompare(rightCellId))
        .map(([cellId, containerCount]) => ({ cellId, containerCount }));
    },

    async getRackSectionSlotStorage(sectionId, slotNo) {
      const { data: cells, error: cellsError } = await deps.supabase
        .from('cells')
        .select('id')
        .eq('rack_section_id', sectionId)
        .eq('slot_no', slotNo);

      if (cellsError) {
        throw cellsError;
      }

      const cellIds = (cells ?? []).map((cell) => cell.id);

      if (cellIds.length === 0) {
        return { published: false, rows: [] };
      }

      const data = await deps.locationReadRepo.listCellStorageByIds(cellIds);
      const rows = await attachProductsToCellStorageRows(deps.supabase, data);

      return {
        published: true,
        rows: rows
          .filter((row): row is typeof row & { cell_id: string } => row.cell_id !== null)
          .map(mapCellStorageSnapshotRowToDomain)
      };
    },

    async moveContainerByCell(command) {
      const targetLocation = await deps.placementRepo.resolveExecutableLocationForCell(
        command.targetCellId
      );

      if (!targetLocation) {
        const targetCell = await deps.placementRepo.resolvePlaceTarget(command.targetCellId);

        throw new ApiError(
          409,
          'INVALID_TARGET_CELL',
          targetCell ? 'Target cell is not in a published layout.' : 'Target cell was not found.'
        );
      }

      const previousPlacement = await deps.placementRepo.getActivePlacement(command.containerId);

      if (!previousPlacement) {
        throw new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is not currently placed.');
      }

      let moveResult;

      try {
        moveResult = await deps.executionService.moveContainerCanonical({
          containerId: command.containerId,
          targetLocationId: targetLocation.locationId,
          actorId: command.actorId
        });
      } catch (error) {
        throw mapLegacyCellMoveError(error) ?? error;
      }

      const activePlacement = await deps.placementRepo.getActivePlacement(command.containerId);

      if (!activePlacement) {
        throw new ApiError(
          409,
          'PLACEMENT_CONFLICT',
          'Container move did not create a rack placement projection.'
        );
      }

      return {
        action: 'moved',
        containerId: command.containerId,
        fromCellId: previousPlacement.cellId,
        toCellId: activePlacement.cellId,
        previousPlacementId: previousPlacement.placementId,
        placementId: activePlacement.placementId,
        occurredAt: moveResult.occurredAt
      };
    }
  };
}
