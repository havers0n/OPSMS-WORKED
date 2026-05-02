import { useEffect, useMemo, useRef, useState } from 'react';
import type { FloorWorkspace } from '@wos/domain';
import { Layer, Line, Rect, Stage } from 'react-konva';
import KonvaRuntime from 'konva';
import type { default as Konva } from 'konva';
import {
  useActiveTask,
  useCanvasZoom,
  useCreateFreeWall,
  useCreateRack,
  useDeleteWall,
  useCreateZone,
  useClearSelection,
  useDeleteZone,
  useEditorMode,
  useActiveStorageWorkflow,
  useCancelPlacementInteraction,
  useInteractionScope,
  useClearHighlightedCellIds,
  useHoveredRackId,
  useIsLayoutEditable,
  useSelectedZoneId,
  useSelectedWallId,
  useSetSelectedRackId,
  useSetSelectedWallId,
  useSetSelectedZoneId,
  useSetCanvasZoom,
  useSetEditorMode,
  useSetHoveredRackId,
  useHighlightedCellIds,
  useSetHighlightedCellIds,
  useSetSelectedRackSide,
  useSetSelectedRackIds,
  useSetPlacementMoveTargetCellId,
  useSetSelectedCellId,
  useToggleRackSelection,
  useUpdateRackPosition,
  useUpdateWallGeometry,
  useUpdateZoneRect,
  useMinRackDistance,
  useViewMode,
  useViewStage
} from '@/warehouse/editor/model/editor-selectors';
import type {
  EditorSelection,
  RackSelectionFocus
} from '@/warehouse/editor/model/editor-types';
import { useEditorStore } from '@/warehouse/editor/model/editor-store';
import { useInteractionStore } from '@/warehouse/editor/model/interaction-store';
import {
  useStorageFocusActiveLevel,
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusSelectCell,
  useStorageFocusSelectRack,
  useStorageFocusHandleEmptyCanvasClick
} from '@/warehouse/editor/model/v2/v2-selectors';
import {
  collectRackSemanticLevels,
  resolveIndexForSemanticLevel,
  resolveInitialRackSemanticLevel
} from '@/warehouse/editor/model/storage-level-mapping';
import {
  GRID_SIZE,
  isRackInViewport,
  MAJOR_GRID_SIZE,
  MINOR_GRID_ZOOM_THRESHOLD
} from '@/entities/layout-version/lib/canvas-geometry';
import { usePickingPlanningOverlayStore } from '@/entities/picking-planning/model/overlay-store';
import {
  deriveDisplayedRouteSteps,
  findPackageById
} from '@/entities/picking-planning/model/route-steps';
import {
  indexRouteAnchorStatus,
  resolveRouteStepAnchors
} from '@/features/picking-planning-canvas/model/route-step-geometry';
import { PickingRouteOverlayLayer } from '@/features/picking-planning-canvas/ui/picking-route-overlay-layer';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { CanvasHud } from './canvas-hud';
import { PickingPlanningOverlay } from './picking-planning-overlay';
import { RackLayer } from './rack-layer';
import { SnapGuides } from './shapes/snap-guides';
import { useCanvasSceneModel } from './use-canvas-scene-model';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';
import { useCanvasStageInteractions } from './use-canvas-stage-interactions';
import { useCanvasViewportController } from './use-canvas-viewport-controller';
import { WallLayer } from './wall-layer';
import { ZoneLayer } from './zone-layer';
import { getWarehouseCanvasChromeTokens } from './shapes/warehouse-semantic-canvas-palette';
import {
  recordCanvasComponentRender,
  useCanvasDiagnosticsFlags
} from './canvas-diagnostics';

const EMPTY_RACK_IDS: string[] = [];
const BODY_RACK_FOCUS: RackSelectionFocus = { type: 'body' };
const NONE_SELECTION: EditorSelection = { type: 'none' };

export function EditorCanvas({
  workspace,
  onAddRack: _onAddRack,
  onOpenInspector,
  isStorageV2 = false
}: {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onOpenInspector: () => void;
  /**
   * When true, canvas interaction writes go to the V2 StorageFocusStore
   * instead of the legacy editor selection state (no dual-write).
   * Passed by StorageWorkspaceV2 → WorkspaceCanvasAndPanel → here.
   */
  isStorageV2?: boolean;
}) {
  const zoom = useCanvasZoom();
  const viewMode = useViewMode();
  const viewStage = useViewStage();
  const pickingPlanningPreview = usePickingPlanningOverlayStore(
    (state) => state.preview
  );
  const pickingPlanningActivePackageId = usePickingPlanningOverlayStore(
    (state) => state.activePackageId
  );
  const pickingPlanningReorderedStepIdsByPackageId =
    usePickingPlanningOverlayStore(
      (state) => state.reorderedStepIdsByPackageId
    );
  const isStorageV2Active = isStorageV2 && viewMode === 'storage';
  const editorMode = useEditorMode();
  const layoutDraft = useWorkspaceLayout(workspace);
  const diagnosticsFlags = useCanvasDiagnosticsFlags();
  const isDiagnosticsHitTestDisabled = diagnosticsFlags.hitTest === 'off';
  const isLayoutEditable = useIsLayoutEditable();
  const selectedRackIds = useInteractionStore((state) =>
    isStorageV2Active
      ? EMPTY_RACK_IDS
      : state.selection.type === 'rack'
        ? state.selection.rackIds
        : EMPTY_RACK_IDS
  );
  const selectedRackId = useInteractionStore((state) =>
    isStorageV2Active
      ? null
      : state.selection.type === 'rack'
        ? (state.selection.rackIds[0] ?? null)
        : null
  );
  const selectedRackFocus = useInteractionStore((state) =>
    isStorageV2Active
      ? BODY_RACK_FOCUS
      : state.selection.type === 'rack'
        ? (state.selection.focus ?? BODY_RACK_FOCUS)
        : BODY_RACK_FOCUS
  );
  const selectedRackActiveLevel = useEditorStore((state) =>
    isStorageV2Active ? 0 : state.selectedRackActiveLevel
  );
  const selectedCellId = useInteractionStore((state) =>
    isStorageV2Active
      ? null
      : state.selection.type === 'cell'
        ? state.selection.cellId
        : null
  );
  const selection = useInteractionStore((state) =>
    isStorageV2Active ? NONE_SELECTION : state.selection
  );
  const storageFocusSelectedCellId = useStorageFocusSelectedCellId();
  const storageFocusSelectedRackId = useStorageFocusSelectedRackId();
  const storageFocusActiveLevel = useStorageFocusActiveLevel();
  const interactionScope = useInteractionScope();
  const highlightedCellIds = useHighlightedCellIds();
  const activeTask = useActiveTask();
  const activeStorageWorkflow = useActiveStorageWorkflow();
  const hoveredRackId = useHoveredRackId();
  const clearSelection = useClearSelection();
  const deleteWall = useDeleteWall();
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();
  const setSelectedRackIds = useSetSelectedRackIds();
  const setSelectedRackId = useSetSelectedRackId();
  const setSelectedRackSide = useSetSelectedRackSide();
  const selectedZoneId = useSelectedZoneId();
  const selectedWallId = useSelectedWallId();
  const setSelectedZoneId = useSetSelectedZoneId();
  const setSelectedWallId = useSetSelectedWallId();
  const setSelectedCellId = useSetSelectedCellId();
  const setPlacementMoveTargetCellId = useSetPlacementMoveTargetCellId();
  const cancelPlacementInteraction = useCancelPlacementInteraction();
  const toggleRackSelection = useToggleRackSelection();
  const setHoveredRackId = useSetHoveredRackId();
  const clearHighlightedCellIds = useClearHighlightedCellIds();
  const setHighlightedCellIds = useSetHighlightedCellIds();
  const setCanvasZoom = useSetCanvasZoom();
  const setEditorMode = useSetEditorMode();
  const updateRackPosition = useUpdateRackPosition();
  const updateWallGeometry = useUpdateWallGeometry();
  const updateZoneRect = useUpdateZoneRect();
  const createRack = useCreateRack();
  const createFreeWall = useCreateFreeWall();
  const minRackDistance = useMinRackDistance();

  // V2 focus store actions — always called unconditionally (hook rules).
  // Only wired into the canvas when isStorageV2 && isStorageMode (see isStorageV2Active).
  const storageFocusSelectCell = useStorageFocusSelectCell();
  const storageFocusSelectRack = useStorageFocusSelectRack();
  const storageFocusHandleEmptyCanvasClick =
    useStorageFocusHandleEmptyCanvasClick();

  const isViewMode = viewMode === 'view';
  const shouldShowPickingPlanningOverlay =
    isViewMode && viewStage === 'picking-plan';
  // In View and Storage mode the published rack tree must be
  // used as the source for RackCells so that rackId/faceId/sectionId/levelId
  // in the lookup key match the keys in publishedCellsByStructure.
  // publishedCells is always fetched from the published layout version; the
  // active draft always has fresh UUIDs after create_layout_draft(), causing a
  // permanent identity mismatch when the draft layout is used instead.
  // Fall back to the draft tree when no published version exists; interaction
  // rights still come from viewMode, not from the selected data source.
  const placementLayout =
    isViewMode || viewMode === 'storage'
      ? (workspace?.latestPublished ?? workspace?.activeDraft ?? null)
      : null;
  const racks = useMemo(() => {
    const layout = placementLayout ?? layoutDraft;
    return layout ? layout.rackIds.map((id) => layout.racks[id]) : [];
  }, [placementLayout, layoutDraft]);

  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__WOS_CANVAS_STAGE__ = stageRef.current;
    window.__WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__ =
      KonvaRuntime.autoDrawEnabled;
    return () => {
      if (window.__WOS_CANVAS_STAGE__ === stageRef.current) {
        window.__WOS_CANVAS_STAGE__ = null;
      }
    };
  });

  const [snapGuides, setSnapGuides] = useState<
    Array<{ type: 'x' | 'y'; position: number }>
  >([]);

  const { containerRef, viewport, canvasOffset, isPanning, handleZoom } =
    useCanvasViewportController({
      autoFitRacks: racks,
      setCanvasZoom,
      stageRef,
      viewMode,
      zoom
    });
  const effectiveSelectedCellId = isStorageV2Active
    ? storageFocusSelectedCellId
    : selectedCellId;
  const effectiveSelectedRackId = isStorageV2Active
    ? storageFocusSelectedRackId
    : selectedRackId;
  const effectiveSelectedRackIds = isStorageV2Active
    ? storageFocusSelectedRackId
      ? [storageFocusSelectedRackId]
      : []
    : selectedRackIds;
  const effectiveSelectedRackFocus = isStorageV2Active
    ? { type: 'body' as const }
    : selectedRackFocus;
  const effectiveSelection = isStorageV2Active
    ? storageFocusSelectedCellId
      ? ({
          type: 'cell',
          cellId: storageFocusSelectedCellId
        } as EditorSelection)
      : storageFocusSelectedRackId
        ? ({
            type: 'rack',
            rackIds: [storageFocusSelectedRackId],
            focus: { type: 'body' }
          } as EditorSelection)
        : NONE_SELECTION
    : selection;

  const scene = useCanvasSceneModel({
    activeTask,
    activeStorageWorkflow,
    canvasOffset,
    editorMode,
    highlightedCellIds,
    interactionScope,
    isLayoutEditable,
    layoutDraft,
    placementLayout,
    racks,
    selectedCellId: effectiveSelectedCellId,
    selectedRackFocus: effectiveSelectedRackFocus,
    selectedRackId: effectiveSelectedRackId,
    selectedRackIds: effectiveSelectedRackIds,
    selectedWallId,
    selectedZoneId,
    selection: effectiveSelection,
    viewMode,
    workspace,
    zoom
  });
  const {
    canSelectCells,
    canSelectRack,
    canSelectWall,
    canSelectZone,
    isDrawingWall,
    isDrawingZone,
    isLayoutDrawToolActive,
    isLayoutMode,
    isPlacementMoveMode,
    isPlacing,
    isStorageMode,
    lod
  } = scene.interaction;
  const {
    floorOperationsCellsById,
    highlightedCellIdSet,
    occupiedCellIds,
    publishedCellsById,
    publishedCellsByStructure
  } = scene.lookups;
  const {
    activeCellRackId,
    canvasSelectedCellId,
    moveSourceRackId,
    selectedRack,
    selectedStorageCell,
    selectedWall,
    selectedZone
  } = scene.selection;
  const { moveSourceCellId } = scene.workflow;
  // V2 cell-select callback: resolves level from publishedCellsById before calling selectCell.
  // Passed to RackLayer as onV2StorageCellSelect — only when V2 is active.
  const onV2StorageCellSelect = isStorageV2Active
    ? ({ cellId, rackId }: { cellId: string; rackId: string }) => {
        const cell = publishedCellsById.get(cellId);
        const level = cell?.address.parts.level ?? null;
        storageFocusSelectCell({ cellId, rackId, level });
      }
    : undefined;

  // V2 rack-select callback — only when V2 is active.
  const onV2StorageRackSelect = isStorageV2Active
    ? ({ rackId }: { rackId: string }) => {
        storageFocusSelectRack({
          rackId,
          level: resolveInitialRackSemanticLevel(
            publishedCellsById.values(),
            rackId
          )
        });
      }
    : undefined;

  const primarySelectedRackId = isStorageV2Active
    ? storageFocusSelectedRackId
    : viewMode === 'storage'
      ? selection.type === 'rack'
        ? (selection.rackIds[0] ?? null)
        : selection.type === 'cell'
          ? (publishedCellsById.get(selection.cellId)?.rackId ?? null)
          : selection.type === 'container'
            ? selection.sourceCellId
              ? (publishedCellsById.get(selection.sourceCellId)?.rackId ?? null)
              : null
            : null
      : selectedRackId;
  const selectedRackActiveLevelIndex = useMemo(() => {
    if (!isStorageV2Active) return selectedRackActiveLevel;
    if (!primarySelectedRackId) return null;
    if (storageFocusActiveLevel === null) return null;

    const layout = placementLayout ?? layoutDraft;
    const rack = layout?.racks[primarySelectedRackId] ?? null;
    if (!rack) return null;

    const semanticLevels = collectRackSemanticLevels(rack);
    const idx = resolveIndexForSemanticLevel(
      semanticLevels,
      storageFocusActiveLevel
    );
    return idx;
  }, [
    isStorageV2Active,
    selectedRackActiveLevel,
    primarySelectedRackId,
    storageFocusActiveLevel,
    placementLayout,
    layoutDraft
  ]);
  const {
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
  } = scene.hud;
  const { walls, zones } = scene.layers;
  const canvasChromeTokens = getWarehouseCanvasChromeTokens();
  // Temporary bounded bridge for this PR only: move-target is the only runtime
  // source currently mapped into the canvas-local locate-target channel.
  // This is not the universal upstream locate contract.
  const temporaryLocateTargetCellId =
    isPlacementMoveMode && activeStorageWorkflow?.kind === 'move-container'
      ? activeStorageWorkflow.targetCellId
      : null;
  const forcedVisibleRackIds = useMemo(() => {
    const rackIds = new Set<string>();
    for (const rackId of effectiveSelectedRackIds) {
      rackIds.add(rackId);
    }
    if (primarySelectedRackId) rackIds.add(primarySelectedRackId);
    if (activeCellRackId) rackIds.add(activeCellRackId);
    if (moveSourceRackId) rackIds.add(moveSourceRackId);

    for (const cellId of [
      effectiveSelectedCellId,
      canvasSelectedCellId,
      temporaryLocateTargetCellId,
      moveSourceCellId
    ]) {
      if (!cellId) continue;
      const rackId = publishedCellsById.get(cellId)?.rackId ?? null;
      if (rackId) rackIds.add(rackId);
    }

    return rackIds;
  }, [
    activeCellRackId,
    canvasSelectedCellId,
    effectiveSelectedCellId,
    effectiveSelectedRackIds,
    moveSourceCellId,
    moveSourceRackId,
    primarySelectedRackId,
    publishedCellsById,
    temporaryLocateTargetCellId
  ]);
  const visibleRacks = useMemo(
    () =>
      racks.filter(
        (rack) =>
          forcedVisibleRackIds.has(rack.id) ||
          isRackInViewport(rack, viewport, canvasOffset, zoom)
      ),
    [canvasOffset, forcedVisibleRackIds, racks, viewport, zoom]
  );
  const pickingPlanningActivePackage = useMemo(
    () =>
      findPackageById(
        pickingPlanningPreview?.packages ?? [],
        pickingPlanningActivePackageId
      ),
    [pickingPlanningActivePackageId, pickingPlanningPreview?.packages]
  );
  const pickingPlanningRouteSteps = useMemo(
    () =>
      pickingPlanningActivePackage
        ? deriveDisplayedRouteSteps(
            pickingPlanningActivePackage.route.steps,
            pickingPlanningReorderedStepIdsByPackageId[
              pickingPlanningActivePackage.workPackage.id
            ]
          )
        : [],
    [pickingPlanningActivePackage, pickingPlanningReorderedStepIdsByPackageId]
  );
  const pickingPlanningRouteAnchors = useMemo(
    () =>
      resolveRouteStepAnchors({
        steps: pickingPlanningRouteSteps,
        locationsById: pickingPlanningPreview?.locationsById,
        layout: placementLayout ?? layoutDraft,
        publishedCellsById
      }),
    [
      layoutDraft,
      pickingPlanningPreview?.locationsById,
      pickingPlanningRouteSteps,
      placementLayout,
      publishedCellsById
    ]
  );
  const pickingPlanningStepGeometryById = useMemo(
    () => indexRouteAnchorStatus(pickingPlanningRouteAnchors),
    [pickingPlanningRouteAnchors]
  );

  recordCanvasComponentRender({
    component: 'EditorCanvas',
    propsKeys: ['floorId', 'isStorageV2'],
    stateKeys: [
      'zoom',
      'viewMode',
      'editorMode',
      'canvasOffsetX',
      'canvasOffsetY',
      'viewportWidth',
      'viewportHeight',
      'visibleRackCount',
      'lod',
      'selectedRackId',
      'selectedCellId',
      'hoveredRackId',
      'diagnosticsLabels',
      'diagnosticsHitTest',
      'diagnosticsCells',
      'diagnosticsCellOverlays',
      'diagnosticsCulling',
      'diagnosticsRackLayerRenderer',
      'isActivelyPanning'
    ],
    snapshot: {
      floorId: workspace?.floorId ?? null,
      isStorageV2,
      zoom,
      viewMode,
      editorMode,
      canvasOffsetX: canvasOffset.x,
      canvasOffsetY: canvasOffset.y,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      visibleRackCount: visibleRacks.length,
      lod,
      selectedRackId: effectiveSelectedRackId,
      selectedCellId: effectiveSelectedCellId,
      hoveredRackId,
      diagnosticsLabels: diagnosticsFlags.labels,
      diagnosticsHitTest: diagnosticsFlags.hitTest,
      diagnosticsCells: diagnosticsFlags.cells,
      diagnosticsCellOverlays: diagnosticsFlags.cellOverlays,
      diagnosticsCulling: diagnosticsFlags.enableProductionCellCulling,
      diagnosticsRackLayerRenderer: diagnosticsFlags.rackLayerRenderer,
      isActivelyPanning: isPanning
    }
  });

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const isDrawingZoneRef = useRef(isDrawingZone);
  isDrawingZoneRef.current = isDrawingZone;
  const isDrawingWallRef = useRef(isDrawingWall);
  isDrawingWallRef.current = isDrawingWall;
  const interactionScopeRef = useRef(interactionScope);
  interactionScopeRef.current = interactionScope;
  const selectedZoneIdRef = useRef(selectedZoneId);
  selectedZoneIdRef.current = selectedZoneId;
  const selectedWallIdRef = useRef(selectedWallId);
  selectedWallIdRef.current = selectedWallId;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const cancelPlacementInteractionRef = useRef(cancelPlacementInteraction);
  cancelPlacementInteractionRef.current = cancelPlacementInteraction;
  const selectedRackIdsRef = useRef(effectiveSelectedRackIds);
  selectedRackIdsRef.current = effectiveSelectedRackIds;
  const deleteZoneRef = useRef(deleteZone);
  deleteZoneRef.current = deleteZone;
  const deleteWallRef = useRef(deleteWall);
  deleteWallRef.current = deleteWall;

  const {
    cancelDrawWall,
    cancelDrawZone,
    draftWallLine,
    draftZoneRect,
    marquee,
    onMouseDown,
    onMouseMove,
    onMouseUp
  } = useCanvasStageInteractions({
    cancelPlacementInteraction,
    clearHighlightedCellIds,
    clearSelection,
    createRack,
    createZone,
    createFreeWall,
    interactionScope,
    isDrawingWall,
    isDrawingZone,
    isLayoutMode,
    isPlacing,
    layoutDraft,
    setSelectedRackIds,
    stageRef,
    viewport,
    // V2: replace clearSelection with focus-store handler in storage V2 path
    onStorageEmptyClick: isStorageV2Active
      ? storageFocusHandleEmptyCanvasClick
      : undefined
  });

  useCanvasKeyboardShortcuts({
    isLayoutEditable,
    isPlacingRef,
    isDrawingZoneRef,
    isDrawingWallRef,
    interactionScopeRef,
    cancelPlacementInteractionRef,
    clearSelectionRef,
    selectedRackIdsRef,
    selectedZoneIdRef,
    selectedWallIdRef,
    deleteZoneRef,
    deleteWallRef,
    cancelDrawZone,
    cancelDrawWall,
    setEditorMode,
    clearHighlightedCellIds
  });

  useEffect(() => {
    if (!isViewMode) {
      clearHighlightedCellIds();
    }
  }, [clearHighlightedCellIds, isViewMode]);

  useEffect(() => {
    if (!canSelectRack && hoveredRackId !== null) {
      setHoveredRackId(null);
    }
  }, [canSelectRack, hoveredRackId, setHoveredRackId]);

  const gridLineData = useMemo(() => {
    if (!viewport.width || !viewport.height) {
      const empty = {
        v: [] as number[],
        h: [] as number[],
        startX: 0,
        endX: 0,
        startY: 0,
        endY: 0
      };
      return { major: empty, minor: null as typeof empty | null };
    }

    const offsetX = canvasOffset.x / zoom;
    const offsetY = canvasOffset.y / zoom;
    const visibleW = viewport.width / zoom;
    const visibleH = viewport.height / zoom;

    const calcGrid = (step: number) => {
      const startX = Math.floor(-offsetX / step) * step;
      const endX = startX + visibleW + step * 2;
      const startY = Math.floor(-offsetY / step) * step;
      const endY = startY + visibleH + step * 2;
      const v: number[] = [];
      for (let x = startX; x <= endX; x += step) v.push(x);
      const h: number[] = [];
      for (let y = startY; y <= endY; y += step) h.push(y);
      return { v, h, startX, endX, startY, endY };
    };

    return {
      major: calcGrid(MAJOR_GRID_SIZE),
      // Minor 1 m grid only visible when zoomed in enough
      minor: zoom >= MINOR_GRID_ZOOM_THRESHOLD ? calcGrid(GRID_SIZE) : null
    };
  }, [zoom, viewport.width, viewport.height, canvasOffset]);

  // Alias for SnapGuides — always use major grid span as the guide extent
  const gridLines = gridLineData.major;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden"
      style={{
        touchAction: 'none',
        cursor: isPanning
          ? 'grabbing'
          : isLayoutDrawToolActive
            ? 'crosshair'
            : 'default',
        background: isPlacing
          ? canvasChromeTokens.backgroundLocate
          : isDrawingZone
            ? canvasChromeTokens.backgroundZone
            : isDrawingWall
              ? canvasChromeTokens.backgroundWall
              : canvasChromeTokens.background
      }}
    >
      {!layoutDraft && (
        <div
          className="flex h-full items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Loading layout...
        </div>
      )}

      {layoutDraft && (
        <>
          <CanvasHud
            viewport={viewport}
            zoom={zoom}
            hintText={hintText}
            isLayoutDrawToolActive={isLayoutDrawToolActive}
            isPlacing={isPlacing}
            isDrawingZone={isDrawingZone}
            isPlacementMoveMode={isPlacementMoveMode}
            shouldShowLayoutRackGeometryBar={shouldShowLayoutRackGeometryBar}
            shouldShowLayoutRackSideHandles={shouldShowLayoutRackSideHandles}
            shouldShowLayoutZoneBar={shouldShowLayoutZoneBar}
            shouldShowLayoutWallBar={shouldShowLayoutWallBar}
            // In Storage V2, inspector ownership lives in StorageInspectorV2.
            // Prevent dead "Inspect" affordance wiring from the legacy path.
            shouldShowStorageCellBar={
              isStorageV2Active ? false : shouldShowStorageCellBar
            }
            selectedRack={selectedRack}
            selectedRackAnchorRect={selectedRackAnchorRect}
            selectedRackSideFocus={selectedRackSideFocus}
            selectedZone={selectedZone}
            selectedZoneAnchorRect={selectedZoneAnchorRect}
            selectedWall={selectedWall}
            selectedWallAnchorRect={selectedWallAnchorRect}
            selectedStorageCell={selectedStorageCell}
            selectedStorageCellAnchorRect={selectedStorageCellAnchorRect}
            onOpenInspector={onOpenInspector}
            onSelectRackSide={(side) => {
              if (selectedRack) {
                setSelectedRackSide(selectedRack.id, side);
              }
            }}
            onZoomOut={() => handleZoom(-0.1)}
            onZoomReset={() => setCanvasZoom(1)}
            onZoomIn={() => handleZoom(0.1)}
          />

          {shouldShowPickingPlanningOverlay && (
            <PickingPlanningOverlay
              stepGeometryById={pickingPlanningStepGeometryById}
            />
          )}

          {viewport.width > 0 && viewport.height > 0 && (
            <Stage
              ref={stageRef}
              width={viewport.width}
              height={viewport.height}
              x={canvasOffset.x}
              y={canvasOffset.y}
              scale={{ x: zoom, y: zoom }}
              onWheel={(event) => {
                event.evt.preventDefault();
                const delta = event.evt.deltaY > 0 ? -0.1 : 0.1;
                const pointer = event.target.getStage()?.getPointerPosition();
                handleZoom(delta, pointer ?? undefined);
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            >
              <Layer listening={false}>
                {/* Minor grid: 1 m lines — visible when zoom >= MINOR_GRID_ZOOM_THRESHOLD */}
                {gridLineData.minor &&
                  gridLineData.minor.v.map((x) => (
                    <Line
                      key={`mn-v-${x}`}
                      points={[
                        x,
                        gridLineData.minor!.startY,
                        x,
                        gridLineData.minor!.endY
                      ]}
                      stroke={
                        isPlacing
                          ? canvasChromeTokens.gridLocate
                          : canvasChromeTokens.gridMinor
                      }
                      strokeWidth={1}
                      strokeScaleEnabled={false}
                      opacity={0.6}
                    />
                  ))}
                {gridLineData.minor &&
                  gridLineData.minor.h.map((y) => (
                    <Line
                      key={`mn-h-${y}`}
                      points={[
                        gridLineData.minor!.startX,
                        y,
                        gridLineData.minor!.endX,
                        y
                      ]}
                      stroke={
                        isPlacing
                          ? canvasChromeTokens.gridLocate
                          : canvasChromeTokens.gridMinor
                      }
                      strokeWidth={1}
                      strokeScaleEnabled={false}
                      opacity={0.6}
                    />
                  ))}
                {/* Major grid: 5 m lines — always visible */}
                {gridLineData.major.v.map((x) => (
                  <Line
                    key={`mj-v-${x}`}
                    points={[
                      x,
                      gridLineData.major.startY,
                      x,
                      gridLineData.major.endY
                    ]}
                    stroke={
                      isPlacing
                        ? canvasChromeTokens.gridLocate
                        : canvasChromeTokens.gridMajor
                    }
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.7}
                  />
                ))}
                {gridLineData.major.h.map((y) => (
                  <Line
                    key={`mj-h-${y}`}
                    points={[
                      gridLineData.major.startX,
                      y,
                      gridLineData.major.endX,
                      y
                    ]}
                    stroke={
                      isPlacing
                        ? canvasChromeTokens.gridLocate
                        : canvasChromeTokens.gridMajor
                    }
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.7}
                  />
                ))}
                {/* Origin marker at world (0, 0) */}
                <Line
                  points={[-14, 0, 14, 0]}
                  stroke={canvasChromeTokens.originStroke}
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                  opacity={0.8}
                />
                <Line
                  points={[0, -14, 0, 14]}
                  stroke={canvasChromeTokens.originStroke}
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                  opacity={0.8}
                />
              </Layer>

              <ZoneLayer
                canSelectZone={canSelectZone}
                draftZoneRect={draftZoneRect}
                getRelativePointerPosition={() =>
                  stageRef.current?.getRelativePointerPosition() ?? null
                }
                isLayoutEditable={isLayoutEditable}
                selectedZoneId={selectedZoneId}
                setSelectedZoneId={setSelectedZoneId}
                updateZoneRect={updateZoneRect}
                zoneLookup={layoutDraft.zones}
                zones={zones}
              />

              <WallLayer
                canSelectWall={canSelectWall}
                draftWallLine={draftWallLine}
                getRelativePointerPosition={() =>
                  stageRef.current?.getRelativePointerPosition() ?? null
                }
                isLayoutEditable={isLayoutEditable}
                selectedWallId={selectedWallId}
                setSelectedWallId={setSelectedWallId}
                updateWallGeometry={updateWallGeometry}
                wallLookup={layoutDraft.walls}
                walls={walls}
              />

              <SnapGuides guides={snapGuides} gridLines={gridLines} />

              <RackLayer
                activeCellRackId={activeCellRackId}
                canSelectCells={canSelectCells}
                canSelectRack={canSelectRack}
                diagnosticsFlags={diagnosticsFlags}
                diagnosticsViewport={{
                  canvasOffset,
                  viewport,
                  zoom
                }}
                isActivelyPanning={isPanning}
                canvasSelectedCellId={canvasSelectedCellId}
                cellRuntimeById={floorOperationsCellsById}
                clearHighlightedCellIds={clearHighlightedCellIds}
                highlightedCellIds={highlightedCellIdSet}
                hoveredRackId={hoveredRackId}
                isLayoutEditable={isLayoutEditable}
                isLayoutMode={isLayoutMode}
                isPlacing={isPlacing}
                isRackPassiveScopeActive={interactionScope !== 'idle'}
                isStorageMode={isStorageMode}
                isViewMode={isViewMode}
                isWorkflowScope={isPlacementMoveMode}
                lod={lod}
                zoom={zoom}
                minRackDistance={minRackDistance}
                moveSourceCellId={moveSourceCellId}
                moveSourceRackId={moveSourceRackId}
                temporaryLocateTargetCellId={temporaryLocateTargetCellId}
                occupiedCellIds={occupiedCellIds}
                publishedCellsByStructure={publishedCellsByStructure}
                primarySelectedRackId={primarySelectedRackId}
                rackLookup={layoutDraft.racks}
                racks={visibleRacks}
                selectedRackActiveLevel={selectedRackActiveLevelIndex}
                selectedRackIds={effectiveSelectedRackIds}
                setHighlightedCellIds={setHighlightedCellIds}
                setHoveredRackId={
                  isDiagnosticsHitTestDisabled
                    ? () => undefined
                    : setHoveredRackId
                }
                setPlacementMoveTargetCellId={setPlacementMoveTargetCellId}
                setSelectedCellId={setSelectedCellId}
                setSelectedRackId={setSelectedRackId}
                setSelectedRackIds={setSelectedRackIds}
                setSnapGuides={setSnapGuides}
                toggleRackSelection={toggleRackSelection}
                updateRackPosition={updateRackPosition}
                onV2StorageCellSelect={onV2StorageCellSelect}
                onV2StorageRackSelect={onV2StorageRackSelect}
              />

              {shouldShowPickingPlanningOverlay && (
                <PickingRouteOverlayLayer
                  anchors={pickingPlanningRouteAnchors}
                />
              )}

              {/* ── Marquee selection overlay (topmost, non-interactive) ── */}
              <Layer listening={false}>
                {marquee && (
                  <Rect
                    x={Math.min(marquee.x1, marquee.x2)}
                    y={Math.min(marquee.y1, marquee.y2)}
                    width={Math.abs(marquee.x2 - marquee.x1)}
                    height={Math.abs(marquee.y2 - marquee.y1)}
                    fill={canvasChromeTokens.marqueeFill}
                    stroke={canvasChromeTokens.marqueeStroke}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    dash={[4, 3]}
                  />
                )}
              </Layer>
            </Stage>
          )}
        </>
      )}
    </div>
  );
}
