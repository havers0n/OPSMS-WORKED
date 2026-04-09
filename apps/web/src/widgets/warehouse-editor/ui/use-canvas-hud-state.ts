import { useMemo } from 'react';
import type { Cell, LayoutDraft } from '@wos/domain';
import type {
  ActiveLayoutTask,
  ActiveStorageWorkflow,
  EditorSelection,
  InteractionScope,
  RackSelectionFocus
} from '@/entities/layout-version/model/editor-types';
import {
  getCellCanvasRect,
  getRackCanvasRect,
  getWallCanvasRect,
  getZoneCanvasRect,
  projectCanvasRectToViewport
} from '@/entities/layout-version/lib/canvas-geometry';
import type { CanvasCapabilities } from './use-canvas-capabilities';

type UseCanvasHudStateParams = {
  activeTask: ActiveLayoutTask;
  activeStorageWorkflow: ActiveStorageWorkflow;
  canvasOffset: { x: number; y: number };
  capabilities: CanvasCapabilities;
  interactionScope: InteractionScope;
  isLayoutEditable: boolean;
  layoutDraft: LayoutDraft | null;
  placementLayout: LayoutDraft | null;
  publishedCellsById: Map<string, Cell>;
  selectedCellId: string | null;
  selectedRackFocus: RackSelectionFocus;
  selectedRackId: string | null;
  selectedRackIds: string[];
  selectedWallId: string | null;
  selectedZoneId: string | null;
  selection: EditorSelection;
  zoom: number;
};

/**
 * Canvas HUD state — selection resolution, anchor projection, and HUD visibility.
 *
 * Responsibilities:
 *   - resolve selected entities (selectedRack, selectedZone, selectedWall, selectedStorageCell)
 *     from draft + selection IDs, gated by active tool state
 *   - project world-space entity rects → viewport anchor rects (world → viewport)
 *   - decide HUD element visibility (shouldShow*)
 *   - derive canvasSelectedCellId and source/target rack IDs for storage workflow
 *   - generate the context-sensitive hint text string
 *
 * Pure computations — no server calls, no store subscriptions.
 * All mode flags consumed via `capabilities` to avoid spreading raw mode checks.
 */
export function useCanvasHudState({
  activeTask,
  activeStorageWorkflow,
  canvasOffset,
  capabilities,
  interactionScope,
  isLayoutEditable,
  layoutDraft,
  placementLayout,
  publishedCellsById,
  selectedCellId,
  selectedRackFocus,
  selectedRackId,
  selectedRackIds,
  selectedWallId,
  selectedZoneId,
  selection,
  zoom
}: UseCanvasHudStateParams) {
  const {
    interactionLevel,
    isDrawingWall,
    isDrawingZone,
    isLayoutDrawToolActive,
    isLayoutMode,
    isPlacementMoveMode,
    isStorageMode,
    isViewMode
  } = capabilities;

  const moveTargetCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.targetCellId : null;
  const moveSourceCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.sourceCellId : null;

  // — Selection resolution: look up entities from draft using selection IDs —
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

  // — Anchor projection: world-space canvas rect → viewport-space rect —
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
  const shouldShowLayoutRackGeometryBar =
    interactionScope === 'object' &&
    isLayoutEditable &&
    activeTask === null &&
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

  // — Context-sensitive hint text —
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
        shouldShowLayoutRackGeometryBar,
        shouldShowLayoutRackSideHandles,
        shouldShowLayoutWallBar,
        shouldShowLayoutZoneBar,
        shouldShowStorageCellBar
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
      hintText,
      moveSourceCellId,
      moveSourceRackId,
      selectedRack,
      selectedRackAnchorRect,
      selectedRackSideFocus,
      selectedStorageCell,
      selectedStorageCellAnchorRect,
      selectedWall,
      selectedWallAnchorRect,
      selectedZone,
      selectedZoneAnchorRect,
      shouldShowLayoutRackGeometryBar,
      shouldShowLayoutRackSideHandles,
      shouldShowLayoutWallBar,
      shouldShowLayoutZoneBar,
      shouldShowStorageCellBar
    ]
  );
}
