import { useMemo } from 'react';
import type { FloorWorkspace } from '@wos/domain';
import type { ViewMode } from '@/warehouse/editor/model/editor-types';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useFloorOperationsCells } from '@/entities/location/api/use-floor-operations-cells';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { indexOccupiedCellIds } from '@/entities/cell/lib/occupied-cell-lookup';
import { indexPublishedCellsByStructure } from '@/entities/cell/lib/published-cell-lookup';

type FloorSceneDataParams = {
  viewMode: ViewMode;
  workspace: FloorWorkspace | null;
};

/**
 * Floor scene data layer — owns all server-state fetching for the canvas.
 *
 * Responsibilities:
 *   - derive floor IDs from viewMode + workspace
 *   - fetch cell occupancy, operations cells, published cells
 *   - build derived lookup indexes (publishedCellsById, occupiedCellIds, etc.)
 *
 * Does NOT know about: selection, HUD, camera, capabilities, or interaction flow.
 */
export function useFloorSceneData({ viewMode, workspace }: FloorSceneDataParams) {
  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';

  const placementFloorId = isViewMode || isStorageMode ? workspace?.floorId ?? null : null;
  const runtimeFloorId = isViewMode || isStorageMode ? workspace?.floorId ?? null : null;

  const { data: floorCellOccupancy = [] } = useFloorLocationOccupancy(placementFloorId);
  const { data: floorOperationsCells = [] } = useFloorOperationsCells(runtimeFloorId);
  const { data: publishedCells = [] } = usePublishedCells(placementFloorId);

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

  return {
    floorOperationsCellsById,
    occupiedCellIds,
    publishedCells,
    publishedCellsById,
    publishedCellsByStructure
  };
}
