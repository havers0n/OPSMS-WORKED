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
import { useFloorSceneData } from './use-floor-scene-data';
import { useCanvasCapabilities } from './use-canvas-capabilities';
import { useCanvasHudState } from './use-canvas-hud-state';

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
 *   - useFloorSceneData      → server-state fetching + derived cell lookup indexes
 *   - useCanvasCapabilities  → mode flags, capability permissions, semantic zoom
 *   - useCanvasHudState      → selection resolution, anchor projection, HUD visibility
 *
 * Owns:
 *   - layer list memos (zones, walls) from layoutDraft
 *   - highlightedCellIdSet memo from highlightedCellIds array
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

  const capabilities = useCanvasCapabilities({
    activeStorageWorkflow,
    editorMode,
    isLayoutEditable,
    viewMode
  });

  const {
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
  } = capabilities;

  const { hud, selection: resolvedSelection, workflow } = useCanvasHudState({
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
  });

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

  return useMemo(
    () => ({
      hud,
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
      selection: resolvedSelection,
      workflow
    }),
    [
      canSelectCells,
      canSelectRack,
      canSelectWall,
      canSelectZone,
      floorOperationsCellsById,
      highlightedCellIdSet,
      hud,
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
      nonRackLocationMarkers,
      occupiedCellIds,
      placementLayout,
      publishedCellsByStructure,
      racks,
      resolvedSelection,
      walls,
      workflow,
      zones
    ]
  );
}
