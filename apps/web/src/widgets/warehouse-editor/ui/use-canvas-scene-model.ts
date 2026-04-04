import { useMemo } from 'react';
import type { FloorWorkspace, LayoutDraft, Rack } from '@wos/domain';
import {
  type ActiveStorageWorkflow,
  type EditorMode,
  type EditorSelection,
  type InteractionScope,
  type RackSelectionFocus,
  type ViewMode
} from '@/entities/layout-version/model/editor-types';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useFloorOperationsCells } from '@/entities/location/api/use-floor-operations-cells';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { indexOccupiedCellIds } from '@/entities/cell/lib/occupied-cell-lookup';
import { indexPublishedCellsByStructure } from '@/entities/cell/lib/published-cell-lookup';
import {
  getCellCanvasRect,
  getCanvasInteractionLevel,
  getCanvasLOD,
  getRackCanvasRect,
  getWallCanvasRect,
  getZoneCanvasRect,
  projectCanvasRectToViewport
} from '../lib/canvas-geometry';

type CanvasOffset = {
  x: number;
  y: number;
};

type UseCanvasSceneModelParams = {
  activeStorageWorkflow: ActiveStorageWorkflow;
  canvasOffset: CanvasOffset;
  editorMode: EditorMode;
  highlightedCellIds: string[];
  interactionScope: InteractionScope;
  isLayoutEditable: boolean;
  layoutDraft: LayoutDraft | null;
  placementLayout: LayoutDraft | null;
  racks: Rack[];
  selectedCellId: string | null;
  selectedRackFocus: RackSelectionFocus;
  selectedRackId: string | null;
  selectedRackIds: string[];
  selectedWallId: string | null;
  selectedZoneId: string | null;
  selection: EditorSelection;
  viewMode: ViewMode;
  workspace: FloorWorkspace | null;
  zoom: number;
};

export function useCanvasSceneModel({
  activeStorageWorkflow,
  canvasOffset,
  editorMode,
  highlightedCellIds,
  interactionScope,
  isLayoutEditable,
  layoutDraft,
  placementLayout,
  racks,
  selectedCellId,
  selectedRackFocus,
  selectedRackId,
  selectedRackIds,
  selectedWallId,
  selectedZoneId,
  selection,
  viewMode,
  workspace,
  zoom
}: UseCanvasSceneModelParams) {
  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';
  const isLayoutMode = viewMode === 'layout';

  const moveTargetCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.targetCellId : null;
  const moveSourceCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.sourceCellId : null;
  const isPlacementMoveMode = activeStorageWorkflow?.kind === 'move-container';
  const isPlacing = editorMode === 'place' && isLayoutEditable;
  const isDrawingZone = editorMode === 'draw-zone' && isLayoutEditable;
  const isDrawingWall = editorMode === 'draw-wall' && isLayoutEditable;
  const isLayoutDrawToolActive = isPlacing || isDrawingZone || isDrawingWall;
  const placementFloorId = isViewMode || isStorageMode ? workspace?.floorId ?? null : null;
  const runtimeFloorId = isViewMode ? workspace?.floorId ?? null : null;
  const { data: floorCellOccupancy = [] } = useFloorLocationOccupancy(placementFloorId);
  const { data: floorOperationsCells = [] } = useFloorOperationsCells(runtimeFloorId);
  const { data: publishedCells = [] } = usePublishedCells(
    placementFloorId
  );

  const zones = useMemo(
    () => (layoutDraft
      ? layoutDraft.zoneIds
        .map((id) => layoutDraft.zones[id])
        .filter((zone) => Boolean(zone))
      : []),
    [layoutDraft]
  );
  const walls = useMemo(
    () => (layoutDraft
      ? layoutDraft.wallIds
        .map((id) => layoutDraft.walls[id])
        .filter((wall) => Boolean(wall))
      : []),
    [layoutDraft]
  );
  const publishedCellsByStructure = useMemo(
    () => indexPublishedCellsByStructure(publishedCells),
    [publishedCells]
  );
  const occupiedCellIds = useMemo(
    () => indexOccupiedCellIds(floorCellOccupancy),
    [floorCellOccupancy]
  );
  const floorOperationsCellsById = useMemo(
    () => new Map(floorOperationsCells.map((cell) => [cell.cellId, cell])),
    [floorOperationsCells]
  );
  const highlightedCellIdSet = useMemo(
    () => new Set(highlightedCellIds),
    [highlightedCellIds]
  );
  const lod = getCanvasLOD(zoom);
  const interactionLevel = getCanvasInteractionLevel(lod);
  const canSelectRack =
    !isLayoutDrawToolActive &&
    !isPlacementMoveMode &&
    (isLayoutMode || ((isViewMode || isStorageMode) && interactionLevel === 'L1'));
  const canSelectZone =
    isLayoutMode &&
    !isLayoutDrawToolActive &&
    !isPlacementMoveMode;
  const canSelectWall =
    isLayoutMode &&
    !isLayoutDrawToolActive &&
    !isPlacementMoveMode;
  const canSelectCells =
    !isLayoutDrawToolActive &&
    (isViewMode || isStorageMode) &&
    interactionLevel === 'L3';
  const selectedContainerSourceCellId =
    selection.type === 'container' ? selection.sourceCellId ?? null : null;
  const canvasSelectedCellId = isPlacementMoveMode
    ? moveTargetCellId
    : selectedCellId ?? selectedContainerSourceCellId;
  const publishedCellsById = useMemo(
    () => new Map(publishedCells.map((cell) => [cell.id, cell])),
    [publishedCells]
  );
  const selectedStorageCell = selectedCellId
    ? publishedCellsById.get(selectedCellId) ?? null
    : null;
  const activeCellRackId =
    canvasSelectedCellId ? publishedCellsById.get(canvasSelectedCellId)?.rackId ?? null : null;
  const moveSourceRackId =
    moveSourceCellId ? publishedCellsById.get(moveSourceCellId)?.rackId ?? null : null;
  const selectedRack =
    selectedRackId && !isLayoutDrawToolActive && layoutDraft
      ? layoutDraft.racks[selectedRackId]
      : null;
  const selectedRackAnchorRect = selectedRack
    ? projectCanvasRectToViewport(getRackCanvasRect(selectedRack), zoom, canvasOffset)
    : null;
  const selectedRackSideFocus =
    selectedRackFocus.type === 'side' ? selectedRackFocus.side : null;
  const selectedZone =
    selectedZoneId && !isDrawingZone && layoutDraft ? layoutDraft.zones[selectedZoneId] : null;
  const selectedZoneAnchorRect = selectedZone
    ? projectCanvasRectToViewport(getZoneCanvasRect(selectedZone), zoom, canvasOffset)
    : null;
  const selectedWall =
    selectedWallId && !isLayoutDrawToolActive && layoutDraft
      ? layoutDraft.walls[selectedWallId] ?? null
      : null;
  const selectedWallAnchorRect = selectedWall
    ? projectCanvasRectToViewport(getWallCanvasRect(selectedWall), zoom, canvasOffset)
    : null;
  const selectedStorageCellRack =
    isStorageMode && selectedStorageCell && placementLayout
      ? placementLayout.racks[selectedStorageCell.rackId] ?? null
      : null;
  const selectedStorageCellCanvasRect =
    selectedStorageCell && selectedStorageCellRack
      ? getCellCanvasRect(selectedStorageCellRack, selectedStorageCell)
      : null;
  const selectedStorageCellAnchorRect =
    selectedStorageCellCanvasRect
      ? projectCanvasRectToViewport(selectedStorageCellCanvasRect, zoom, canvasOffset)
      : null;
  const shouldShowLayoutRackBar =
    interactionScope === 'object' &&
    isLayoutEditable &&
    selectedRack !== null &&
    selectedRackAnchorRect !== null &&
    selectedRackIds.length === 1;
  const shouldShowLayoutZoneBar =
    interactionScope === 'object' &&
    isLayoutEditable &&
    selectedZone !== null &&
    selectedZoneAnchorRect !== null;
  const shouldShowLayoutWallBar =
    interactionScope === 'object' &&
    isLayoutEditable &&
    selectedWall !== null &&
    selectedWallAnchorRect !== null;
  const shouldShowLayoutRackSideHandles =
    interactionScope === 'object' &&
    isLayoutMode &&
    !isLayoutDrawToolActive &&
    selectedRack !== null &&
    selectedRackAnchorRect !== null &&
    selectedRackIds.length === 1;
  const shouldShowStorageCellBar =
    interactionScope === 'object' &&
    isStorageMode &&
    interactionLevel === 'L3' &&
    selectedStorageCell !== null &&
    selectedStorageCellAnchorRect !== null;
  const hintText = isViewMode
    ? interactionLevel === 'L3'
      ? 'View L3 · Click cell to inspect · Esc clear · MMB pan · Scroll zoom'
      : 'View L1 · Click rack to inspect · Esc clear · MMB pan · Scroll zoom'
    : isStorageMode
    ? isPlacementMoveMode
      ? 'Workflow · Click valid empty target cell · Esc cancel move · MMB pan · Scroll zoom'
      : interactionLevel === 'L3'
        ? 'Storage L3 · Click cell to inspect · Esc clear · MMB pan · Scroll zoom'
        : 'Storage L1 · Click rack to inspect · Esc clear · MMB pan · Scroll zoom'
    : isLayoutEditable
      ? isDrawingWall
        ? 'Click and drag to draw a wall · Esc to cancel'
        : 'Drag · Ctrl+click · Drag to select · MMB pan · Scroll zoom · Del'
      : 'Read-only · MMB pan · Scroll zoom';

  return useMemo(
    () => ({
      hud: {
        hintText,
        selectedRackAnchorRect,
        selectedRackSideFocus,
        selectedStorageCellAnchorRect,
        selectedWallAnchorRect,
        selectedZoneAnchorRect,
        shouldShowLayoutRackBar,
        shouldShowLayoutRackSideHandles,
        shouldShowLayoutWallBar,
        shouldShowLayoutZoneBar,
        shouldShowStorageCellBar
      },
      interaction: {
        canSelectCells,
        canSelectRack,
        canSelectWall,
        canSelectZone,
        interactionLevel,
        isDrawingWall,
        isDrawingZone,
        isLayoutDrawToolActive,
        isLayoutMode,
        isPlacementMoveMode,
        isPlacing,
        isStorageMode,
        isViewMode,
        lod
      },
      layers: {
        placementLayout,
        racks,
        walls,
        zones
      },
      lookups: {
        floorOperationsCellsById,
        highlightedCellIdSet,
        occupiedCellIds,
        publishedCellsByStructure
      },
      selection: {
        activeCellRackId,
        canvasSelectedCellId,
        moveSourceRackId,
        selectedRack,
        selectedStorageCell,
        selectedWall,
        selectedZone
      },
      workflow: {
        moveSourceCellId
      }
    }),
    [
      activeCellRackId,
      canvasSelectedCellId,
      canSelectCells,
      canSelectRack,
      canSelectWall,
      canSelectZone,
      floorOperationsCellsById,
      highlightedCellIdSet,
      hintText,
      interactionLevel,
      isDrawingWall,
      isDrawingZone,
      isLayoutDrawToolActive,
      isLayoutMode,
      isPlacementMoveMode,
      isPlacing,
      isStorageMode,
      isViewMode,
      lod,
      moveSourceCellId,
      moveSourceRackId,
      occupiedCellIds,
      placementLayout,
      publishedCellsByStructure,
      racks,
      selectedRack,
      selectedRackAnchorRect,
      selectedRackSideFocus,
      selectedStorageCell,
      selectedStorageCellAnchorRect,
      selectedWall,
      selectedWallAnchorRect,
      selectedZone,
      selectedZoneAnchorRect,
      shouldShowLayoutRackBar,
      shouldShowLayoutRackSideHandles,
      shouldShowLayoutWallBar,
      shouldShowLayoutZoneBar,
      shouldShowStorageCellBar,
      walls,
      zones
    ]
  );
}
