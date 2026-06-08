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
  disableCanvasSceneData?: boolean;
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
export function useFloorSceneData({
  viewMode,
  workspace,
  disableCanvasSceneData = false
}: FloorSceneDataParams) {
  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';

  const floorId =
    disableCanvasSceneData || (!isViewMode && !isStorageMode)
      ? null
      : workspace?.floorId ?? null;
  const placementFloorId = floorId;
  const runtimeFloorId = floorId;

  const floorCellOccupancyQuery = useFloorLocationOccupancy(placementFloorId);
  const floorOperationsCellsQuery = useFloorOperationsCells(runtimeFloorId);
  const publishedCellsQuery = usePublishedCells(placementFloorId);
  const { data: floorCellOccupancy = [] } = floorCellOccupancyQuery;
  const { data: floorOperationsCells = [] } = floorOperationsCellsQuery;
  const { data: publishedCells = [] } = publishedCellsQuery;

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
    publishedCellsByStructure,
    publishedCellsQueryStatus: disableCanvasSceneData ? 'success' : publishedCellsQuery.status
  };
}
