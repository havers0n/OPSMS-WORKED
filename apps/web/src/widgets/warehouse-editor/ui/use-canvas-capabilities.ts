import type { ActiveStorageWorkflow, EditorMode, ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import type { CanvasInteractionLevel, CanvasLOD } from '@/entities/layout-version/lib/canvas-geometry';
import { useSemanticZoom } from '@/widgets/warehouse-editor/model/use-semantic-zoom';

type CanvasCapabilitiesParams = {
  activeStorageWorkflow: ActiveStorageWorkflow;
  editorMode: EditorMode;
  isLayoutEditable: boolean;
  viewMode: ViewMode;
};

export type CanvasCapabilities = {
  // — Mode flags —
  isViewMode: boolean;
  isStorageMode: boolean;
  isLayoutMode: boolean;
  // — Tool state —
  isPlacing: boolean;
  isDrawingZone: boolean;
  isDrawingWall: boolean;
  isLayoutDrawToolActive: boolean;
  isPlacementMoveMode: boolean;
  // — Selection permissions —
  canSelectRack: boolean;
  canSelectZone: boolean;
  canSelectWall: boolean;
  canSelectCells: boolean;
  // — Semantic zoom (from useSemanticZoom) —
  lod: CanvasLOD;
  interactionLevel: CanvasInteractionLevel;
};

/**
 * Canvas capabilities layer — derives what the user can do right now.
 *
 * Responsibilities:
 *   - interpret viewMode + editorMode as readable boolean flags
 *   - call useSemanticZoom and expose lod + interactionLevel
 *   - derive selection permission flags (canSelectRack, etc.) from mode + semantic zoom
 *
 * Pure boolean derivation — no data fetching, no projection math, no selection state.
 */
export function useCanvasCapabilities({
  activeStorageWorkflow,
  editorMode,
  isLayoutEditable,
  viewMode
}: CanvasCapabilitiesParams): CanvasCapabilities {
  const { lod, interactionLevel } = useSemanticZoom();

  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';
  const isLayoutMode = viewMode === 'layout';

  const isPlacementMoveMode = activeStorageWorkflow?.kind === 'move-container';
  const isPlacing = editorMode === 'place' && isLayoutEditable;
  const isDrawingZone = editorMode === 'draw-zone' && isLayoutEditable;
  const isDrawingWall = editorMode === 'draw-wall' && isLayoutEditable;
  const isLayoutDrawToolActive = isPlacing || isDrawingZone || isDrawingWall;

  const canSelectRack =
    !isLayoutDrawToolActive &&
    !isPlacementMoveMode &&
    (isLayoutMode || ((isViewMode || isStorageMode) && interactionLevel === 'L1'));
  const canSelectZone = isLayoutMode && !isLayoutDrawToolActive && !isPlacementMoveMode;
  const canSelectWall = isLayoutMode && !isLayoutDrawToolActive && !isPlacementMoveMode;
  const canSelectCells =
    !isLayoutDrawToolActive &&
    (isViewMode || isStorageMode) &&
    interactionLevel === 'L3';

  return {
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
  };
}
