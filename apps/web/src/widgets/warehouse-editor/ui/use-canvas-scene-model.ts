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
import {
  getCellCanvasRect,
  getRackCanvasRect,
  getWallCanvasRect,
  getZoneCanvasRect,
  projectCanvasRectToViewport
} from '../lib/canvas-geometry';
import { useFloorSceneData } from './use-floor-scene-data';
import { useCanvasCapabilities } from './use-canvas-capabilities';

// Re-export for backward compat — location-layer.tsx imports this type from here
export type { NonRackLocationMarker } from './use-floor-scene-data';

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

/**
 * Canvas scene model — thin orchestration wrapper.
 *
 * Composes:
 *   - useFloorSceneData    → all server-state fetching + derived cell lookups
 *   - useCanvasCapabilities → mode flags, capability permissions, semantic zoom
 *
 * Owns:
 *   - layer list memos (zones, walls) from layoutDraft
 *   - selection resolution (selectedRack, selectedZone, etc. from draft + selection IDs)
 *   - HUD anchor projection math (world → viewport rect)
 *   - HUD visibility decisions (shouldShow*)
 *   - hint text generation
 *   - final output composition
 *
 * Public contract (params + return shape) is unchanged — editor-canvas.tsx does not change.
 */
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
  const {
    floorOperationsCellsById,
    nonRackLocationMarkers,
    occupiedCellIds,
    publishedCellsById,
    publishedCellsByStructure
  } = useFloorSceneData({ viewMode, workspace });

  const {
    isViewMode,
    isStorageMode,
    isLayoutMode,
    isPlacing,
    isDrawingZone,
    isDrawingWall,
    isLayoutDrawToolActive,
    isPlacementMoveMode,
    canSelectRack,
    canSelectZone,
    canSelectWall,
    canSelectCells,
    lod,
    interactionLevel
  } = useCanvasCapabilities({ activeStorageWorkflow, editorMode, isLayoutEditable, viewMode });

  const moveTargetCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.targetCellId : null;
  const moveSourceCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.sourceCellId : null;

  // — Layer lists (from layoutDraft, not server state) —
  const zones = useMemo(
    () =>
      layoutDraft
        ? layoutDraft.zoneIds.map((id) => layoutDraft.zones[id]).filter((zone) => Boolean(zone))
        : [],
    [layoutDraft]
  );
  const walls = useMemo(
    () =>
      layoutDraft
        ? layoutDraft.wallIds.map((id) => layoutDraft.walls[id]).filter((wall) => Boolean(wall))
        : [],
    [layoutDraft]
  );
  const highlightedCellIdSet = useMemo(() => new Set(highlightedCellIds), [highlightedCellIds]);

  // — Selection resolution —
  const selectedContainerSourceCellId =
    selection.type === 'container' ? selection.sourceCellId ?? null : null;
  const canvasSelectedCellId = isPlacementMoveMode
    ? moveTargetCellId
    : selectedCellId ?? selectedContainerSourceCellId;
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
  const selectedRackSideFocus =
    selectedRackFocus.type === 'side' ? selectedRackFocus.side : null;
  const selectedZone =
    selectedZoneId && !isDrawingZone && layoutDraft ? layoutDraft.zones[selectedZoneId] : null;
  const selectedWall =
    selectedWallId && !isLayoutDrawToolActive && layoutDraft
      ? layoutDraft.walls[selectedWallId] ?? null
      : null;

  // — HUD anchor projection math (world → viewport) —
  const selectedRackAnchorRect = selectedRack
    ? projectCanvasRectToViewport(getRackCanvasRect(selectedRack), zoom, canvasOffset)
    : null;
  const selectedZoneAnchorRect = selectedZone
    ? projectCanvasRectToViewport(getZoneCanvasRect(selectedZone), zoom, canvasOffset)
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
  const selectedStorageCellAnchorRect = selectedStorageCellCanvasRect
    ? projectCanvasRectToViewport(selectedStorageCellCanvasRect, zoom, canvasOffset)
    : null;

  // — HUD visibility decisions —
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

  // — Hint text —
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
        nonRackLocationMarkers,
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
      nonRackLocationMarkers,
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
