import { useMemo } from 'react';
import type { FloorWorkspace, LocationType } from '@wos/domain';
import type { ViewMode } from '@/entities/layout-version/model/editor-types';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useFloorOperationsCells } from '@/entities/location/api/use-floor-operations-cells';
import { useFloorNonRackLocations } from '@/entities/location/api/use-floor-non-rack-locations';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { indexOccupiedCellIds } from '@/entities/cell/lib/occupied-cell-lookup';
import { indexPublishedCellsByStructure } from '@/entities/cell/lib/published-cell-lookup';

/** A positioned non-rack floor location with current occupancy count. */
export type NonRackLocationMarker = {
  locationId: string;
  locationCode: string;
  locationType: LocationType;
  containerCount: number;
  /** World position in metres; multiply by WORLD_SCALE for canvas pixels */
  x: number;
  y: number;
};

type FloorSceneDataParams = {
  viewMode: ViewMode;
  workspace: FloorWorkspace | null;
};

/**
 * Floor scene data layer — owns all server-state fetching for the canvas.
 *
 * Responsibilities:
 *   - derive floor IDs from viewMode + workspace
 *   - fetch cell occupancy, operations cells, published cells, non-rack locations
 *   - build derived lookup indexes (publishedCellsById, occupiedCellIds, etc.)
 *   - assemble NonRackLocationMarker[] for storage mode
 *
 * Does NOT know about: selection, HUD, camera, capabilities, or interaction flow.
 */
export function useFloorSceneData({ viewMode, workspace }: FloorSceneDataParams) {
  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';

  const placementFloorId = isViewMode || isStorageMode ? workspace?.floorId ?? null : null;
  const runtimeFloorId = isViewMode ? workspace?.floorId ?? null : null;

  const { data: floorCellOccupancy = [] } = useFloorLocationOccupancy(placementFloorId);
  const { data: floorOperationsCells = [] } = useFloorOperationsCells(runtimeFloorId);
  const { data: publishedCells = [] } = usePublishedCells(placementFloorId);
  const { data: floorNonRackLocations = [] } = useFloorNonRackLocations(
    isStorageMode ? workspace?.floorId ?? null : null
  );

  const publishedCellsByStructure = useMemo(
    () => indexPublishedCellsByStructure(publishedCells),
    [publishedCells]
  );
  const occupiedCellIds = useMemo(
    () => indexOccupiedCellIds(floorCellOccupancy),
    [floorCellOccupancy]
  );
  const publishedCellsById = useMemo(
    () => new Map(publishedCells.map((cell) => [cell.id, cell])),
    [publishedCells]
  );
  const floorOperationsCellsById = useMemo(
    () => new Map(floorOperationsCells.map((cell) => [cell.cellId, cell])),
    [floorOperationsCells]
  );
  const nonRackLocationMarkers = useMemo((): NonRackLocationMarker[] => {
    if (!isStorageMode) return [];
    // Count containers per non-rack location from occupancy data
    const containerCounts = new Map<string, number>();
    for (const row of floorCellOccupancy) {
      if (row.locationType === 'rack_slot') continue;
      containerCounts.set(row.locationId, (containerCounts.get(row.locationId) ?? 0) + 1);
    }
    // Render all positioned non-rack locations (including empty ones)
    return floorNonRackLocations
      .filter((loc) => loc.floorX !== null && loc.floorY !== null)
      .map((loc) => ({
        locationId: loc.id,
        locationCode: loc.code,
        locationType: loc.locationType,
        containerCount: containerCounts.get(loc.id) ?? 0,
        x: loc.floorX as number,
        y: loc.floorY as number
      }));
  }, [isStorageMode, floorCellOccupancy, floorNonRackLocations]);

  return {
    floorOperationsCellsById,
    nonRackLocationMarkers,
    occupiedCellIds,
    publishedCells,
    publishedCellsById,
    publishedCellsByStructure
  };
}
