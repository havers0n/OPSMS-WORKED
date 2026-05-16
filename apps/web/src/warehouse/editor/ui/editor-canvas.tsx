import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getRackLabelRevealPolicy } from './shapes/rack-label-reveal-policy';
import { SelectionOverlayLayer } from './shapes/selection-overlay-layer';
import { SnapGuides } from './shapes/snap-guides';
import { StorageOccupancyOverlay } from './shapes/storage-occupancy-overlay';
import { useCanvasSceneModel } from './use-canvas-scene-model';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';
import { useCanvasStageInteractions } from './use-canvas-stage-interactions';
import { useCanvasViewportController } from './use-canvas-viewport-controller';
import { WallLayer } from './wall-layer';
import { ZoneLayer } from './zone-layer';
import { getWarehouseCanvasChromeTokens } from './shapes/warehouse-semantic-canvas-palette';
import {
  recordCanvasComponentRender,
  recordCanvasRenderMode,
  useCanvasDiagnosticsFlags
} from './canvas-diagnostics';
import type { CanvasRenderMode } from './canvas-render-mode';
import { isCanvasFullDetailRenderMode } from './canvas-render-mode';

const EMPTY_RACK_IDS: string[] = [];
const EMPTY_CELL_ID_SET = new Set<string>();
const BODY_RACK_FOCUS: RackSelectionFocus = { type: 'body' };
const NONE_SELECTION: EditorSelection = { type: 'none' };
const ZOOM_INTERACTION_IDLE_MS = 550;
const noopSetHoveredRackId = () => undefined;

export function EditorCanvas({
  workspace,
  onAddRack: _onAddRack,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onOpenInspector?: () => void;
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
  const isStorageV2Active = viewMode === 'storage';
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
  // True when view/storage mode is forced to show a draft because no published
  // version exists yet. Cell-based features (published cells, picking plan) will
  // be non-functional in this state — the banner and overlay guards rely on this.
  const isDraftFallback =
    (isViewMode || viewMode === 'storage') &&
    placementLayout !== null &&
    workspace?.latestPublished == null;
  const shouldShowPickingPlanningOverlay =
    isViewMode && viewStage === 'picking-plan' && !isDraftFallback;
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

  const { containerRef, viewport, canvasOffset, isPanning, handleZoom, handleWheelZoom } =
    useCanvasViewportController({
      autoFitRacks: racks,
      disableGridDuringPan: diagnosticsFlags.grid === 'off-during-pan',
      hasStorageFocus:
        isStorageV2Active &&
        (storageFocusSelectedRackId !== null ||
          storageFocusSelectedCellId !== null),
      setCanvasZoom,
      stageRef,
      viewMode,
      zoom
    });
  const [isZooming, setIsZooming] = useState(false);
  const zoomIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startZoomInteraction = useCallback(() => {
    setIsZooming(true);
    if (zoomIdleTimerRef.current !== null) {
      globalThis.clearTimeout(zoomIdleTimerRef.current);
    }
    zoomIdleTimerRef.current = globalThis.setTimeout(() => {
      zoomIdleTimerRef.current = null;
      setIsZooming(false);
    }, ZOOM_INTERACTION_IDLE_MS);
  }, []);
  const handleInteractionZoom = (
    delta: number,
    cursor?: { x: number; y: number }
  ) => {
    startZoomInteraction();
    handleZoom(delta, cursor);
  };
  const handleInteractionWheelZoom = useCallback(
    (rawDeltaY: number, cursor?: { x: number; y: number }) => {
      startZoomInteraction();
      handleWheelZoom(rawDeltaY, cursor);
    },
    [handleWheelZoom, startZoomInteraction]
  );
  const onWheelHandler = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const pointer = event.target.getStage()?.getPointerPosition();
      handleInteractionWheelZoom(event.evt.deltaY, pointer ?? undefined);
    },
    [handleInteractionWheelZoom]
  );
  useEffect(
    () => () => {
      if (zoomIdleTimerRef.current !== null) {
        globalThis.clearTimeout(zoomIdleTimerRef.current);
      }
    },
    []
  );
  type RestoreFrameHandle = {
    id: number | ReturnType<typeof globalThis.setTimeout>;
    kind: 'raf' | 'timeout';
  };
  const isInteractingWithCamera = isPanning || isZooming;
  const wasInteractingWithCameraRef = useRef(isInteractingWithCamera);
  const [restoreMode, setRestoreMode] = useState<CanvasRenderMode>('full');
  const [arePostInteractionLabelsReady, setArePostInteractionLabelsReady] =
    useState(true);
  const renderMode: CanvasRenderMode = isInteractingWithCamera
    ? 'interaction-skeleton'
    : wasInteractingWithCameraRef.current
      ? 'restore-base'
      : restoreMode;
  const labelsDeferredAfterInteraction = !arePostInteractionLabelsReady;
  const restoreFrameHandlesRef = useRef<RestoreFrameHandle[]>([]);

  useEffect(() => {
    const cancelRestoreFrames = () => {
      for (const handle of restoreFrameHandlesRef.current) {
        if (
          handle.kind === 'raf' &&
          typeof globalThis.cancelAnimationFrame === 'function'
        ) {
          globalThis.cancelAnimationFrame(handle.id as number);
        } else {
          globalThis.clearTimeout(handle.id);
        }
      }
      restoreFrameHandlesRef.current = [];
    };
    const scheduleRestoreFrame = (callback: () => void) => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        const id = globalThis.requestAnimationFrame(callback);
        restoreFrameHandlesRef.current.push({ id, kind: 'raf' });
        return;
      }
      const id = globalThis.setTimeout(callback, 0);
      restoreFrameHandlesRef.current.push({ id, kind: 'timeout' });
    };
    const getDiagnosticsRestoreStageDelayMs = () => {
      if (typeof window === 'undefined') return 0;
      const value = (
        window as unknown as {
          __WOS_CANVAS_RESTORE_STAGE_DELAY_MS__?: unknown;
        }
      ).__WOS_CANVAS_RESTORE_STAGE_DELAY_MS__;
      return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : 0;
    };
    const scheduleRestoreBoundary = (callback: () => void) => {
      scheduleRestoreFrame(() => {
        const delayMs = getDiagnosticsRestoreStageDelayMs();
        if (delayMs > 0) {
          const id = globalThis.setTimeout(callback, delayMs);
          restoreFrameHandlesRef.current.push({ id, kind: 'timeout' });
          return;
        }
        callback();
      });
    };

    if (isInteractingWithCamera) {
      wasInteractingWithCameraRef.current = true;
      setArePostInteractionLabelsReady(false);
      cancelRestoreFrames();
      return cancelRestoreFrames;
    }

    if (!wasInteractingWithCameraRef.current) {
      return cancelRestoreFrames;
    }

    wasInteractingWithCameraRef.current = false;
    cancelRestoreFrames();
    setArePostInteractionLabelsReady(false);
    setRestoreMode('restore-base');
    scheduleRestoreBoundary(() => {
      setRestoreMode('restore-overlays');
      scheduleRestoreBoundary(() => {
        setRestoreMode('restore-labels');
        scheduleRestoreBoundary(() => {
          setRestoreMode('full');
          scheduleRestoreBoundary(() => {
            setArePostInteractionLabelsReady(true);
          });
        });
      });
    });

    return cancelRestoreFrames;
  }, [isInteractingWithCamera]);
  recordCanvasRenderMode(renderMode);

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
  const handleV2StorageCellSelect = useCallback(
    ({ cellId, rackId }: { cellId: string; rackId: string }) => {
      const cell = publishedCellsById.get(cellId);
      const level = cell?.address.parts.level ?? null;
      storageFocusSelectCell({ cellId, rackId, level });
    },
    [publishedCellsById, storageFocusSelectCell]
  );
  const onV2StorageCellSelect = isStorageV2Active
    ? handleV2StorageCellSelect
    : undefined;

  // V2 rack-select callback — only when V2 is active.
  const handleV2StorageRackSelect = useCallback(
    ({ rackId }: { rackId: string }) => {
      storageFocusSelectRack({
        rackId,
        level: resolveInitialRackSemanticLevel(
          publishedCellsById.values(),
          rackId
        )
      });
    },
    [publishedCellsById, storageFocusSelectRack]
  );
  const onV2StorageRackSelect = isStorageV2Active
    ? handleV2StorageRackSelect
    : undefined;

  const primarySelectedRackId = isStorageV2Active
    ? storageFocusSelectedRackId
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
    if (moveSourceRackId) rackIds.add(moveSourceRackId);

    for (const cellId of [temporaryLocateTargetCellId, moveSourceCellId]) {
      if (!cellId) continue;
      const rackId = publishedCellsById.get(cellId)?.rackId ?? null;
      if (rackId) rackIds.add(rackId);
    }

    return rackIds;
  }, [
    moveSourceCellId,
    moveSourceRackId,
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
  const cellStateOverlaysEnabled =
    (renderMode === 'full' ||
      renderMode === 'restore-overlays' ||
      renderMode === 'restore-labels') &&
    diagnosticsFlags.cellOverlays === 'normal';
  const cellStateOverlayHighlightedCellId =
    cellStateOverlaysEnabled &&
    canvasSelectedCellId !== null &&
    highlightedCellIdSet.size === 1 &&
    highlightedCellIdSet.has(canvasSelectedCellId)
      ? canvasSelectedCellId
      : null;
  const cellStateOverlayLabelRevealPolicy = getRackLabelRevealPolicy({
    lod,
    zoom
  });
  const showCellStateOverlayFocusedFullAddress =
    isCanvasFullDetailRenderMode(renderMode) &&
    !labelsDeferredAfterInteraction &&
    diagnosticsFlags.labels === 'normal' &&
    cellStateOverlayLabelRevealPolicy.showFocusedFullAddress;
  const rackLayerSelectedCellId = cellStateOverlaysEnabled
    ? null
    : canvasSelectedCellId;
  const rackLayerHighlightedCellIds =
    cellStateOverlayHighlightedCellId !== null
      ? EMPTY_CELL_ID_SET
      : highlightedCellIdSet.size === 0
        ? EMPTY_CELL_ID_SET
        : highlightedCellIdSet;
  const isOrdinaryCellStateOverlaySelection =
    cellStateOverlaysEnabled &&
    canvasSelectedCellId !== null &&
    !isPlacementMoveMode;
  const rackLayerActiveCellRackId = isOrdinaryCellStateOverlaySelection
    ? null
    : activeCellRackId;
  const rackLayerPrimarySelectedRackId = isOrdinaryCellStateOverlaySelection
    ? null
    : primarySelectedRackId;
  const cellStateOverlayPrimarySelectedRackId =
    isOrdinaryCellStateOverlaySelection
      ? activeCellRackId
      : primarySelectedRackId;
  const rackLayerSelectedRackActiveLevel =
    rackLayerPrimarySelectedRackId === null
      ? null
      : selectedRackActiveLevelIndex;
  const rackLayerSelectedRackIds = isOrdinaryCellStateOverlaySelection
    ? EMPTY_RACK_IDS
    : effectiveSelectedRackIds;
  const diagnosticsViewport = useMemo(
    () => ({
      canvasOffset: { x: canvasOffset.x, y: canvasOffset.y },
      viewport: { width: viewport.width, height: viewport.height },
      zoom
    }),
    [canvasOffset.x, canvasOffset.y, viewport.height, viewport.width, zoom]
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
      'diagnosticsGrid',
      'diagnosticsHitTest',
      'diagnosticsCells',
      'diagnosticsCellOverlays',
      'diagnosticsCulling',
      'diagnosticsRackLayerRenderer',
      'isActivelyPanning',
      'isZooming',
      'labelsDeferredAfterInteraction',
      'renderMode'
    ],
    snapshot: {
      floorId: workspace?.floorId ?? null,
      isStorageV2Active,
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
      diagnosticsGrid: diagnosticsFlags.grid,
      diagnosticsHitTest: diagnosticsFlags.hitTest,
      diagnosticsCells: diagnosticsFlags.cells,
      diagnosticsCellOverlays: diagnosticsFlags.cellOverlays,
      diagnosticsCulling: diagnosticsFlags.enableProductionCellCulling,
      diagnosticsRackLayerRenderer: diagnosticsFlags.rackLayerRenderer,
      isActivelyPanning: isPanning,
      isZooming,
      labelsDeferredAfterInteraction,
      renderMode
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
      dir="ltr"
      data-testid="warehouse-canvas-stable-ltr"
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
          {isDraftFallback && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center px-3 py-1.5 text-xs font-medium"
              style={{
                background:
                  'color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)',
                color: 'var(--color-warning-foreground, #78350f)'
              }}
            >
              No published version — showing unpublished draft. Publish the
              layout to enable storage features.
            </div>
          )}

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
            onZoomOut={() => handleInteractionZoom(-0.1)}
            onZoomReset={() => {
              startZoomInteraction();
              setCanvasZoom(1);
            }}
            onZoomIn={() => handleInteractionZoom(0.1)}
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
              pixelRatio={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
              x={canvasOffset.x}
              y={canvasOffset.y}
              scale={{ x: zoom, y: zoom }}
              onWheel={onWheelHandler}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
            >
              {!(isPanning && diagnosticsFlags.grid === 'off-during-pan') && (
                <Layer name="grid-layer" listening={false}>
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
              )}

              <Layer name="floor-objects-layer">
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
                  zoneLookup={(placementLayout ?? layoutDraft).zones}
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
                  wallLookup={(placementLayout ?? layoutDraft).walls}
                  walls={walls}
                />

                <SnapGuides guides={snapGuides} gridLines={gridLines} />
              </Layer>

              <RackLayer
                activeCellRackId={rackLayerActiveCellRackId}
                canSelectCells={canSelectCells}
                canSelectRack={canSelectRack}
                diagnosticsFlags={diagnosticsFlags}
                diagnosticsViewport={diagnosticsViewport}
                isActivelyPanning={isPanning}
                labelsDeferred={labelsDeferredAfterInteraction}
                renderMode={renderMode}
                renderSelectionOverlay={false}
                canvasSelectedCellId={rackLayerSelectedCellId}
                cellRuntimeById={floorOperationsCellsById}
                clearHighlightedCellIds={clearHighlightedCellIds}
                highlightedCellIds={rackLayerHighlightedCellIds}
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
                publishedCellsById={publishedCellsById}
                publishedCellsByStructure={publishedCellsByStructure}
                primarySelectedRackId={rackLayerPrimarySelectedRackId}
                rackLookup={(placementLayout ?? layoutDraft).racks}
                racks={visibleRacks}
                selectedRackActiveLevel={rackLayerSelectedRackActiveLevel}
                selectedRackIds={rackLayerSelectedRackIds}
                setHighlightedCellIds={setHighlightedCellIds}
                setHoveredRackId={
                  isDiagnosticsHitTestDisabled
                    ? noopSetHoveredRackId
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

              <Layer name="overlay-layer" listening={false}>
                <StorageOccupancyOverlay
                  isStorageMode={isStorageMode}
                  racks={visibleRacks}
                  primarySelectedRackId={primarySelectedRackId}
                  selectedRackActiveLevel={selectedRackActiveLevelIndex}
                  publishedCellsByStructure={publishedCellsByStructure}
                  occupiedCellIds={occupiedCellIds}
                  cellRuntimeById={floorOperationsCellsById}
                  diagnosticsFlags={diagnosticsFlags}
                  diagnosticsViewport={diagnosticsViewport}
                  renderMode={renderMode}
                  zoom={zoom}
                />

                {cellStateOverlaysEnabled && (
                  <SelectionOverlayLayer
                    selectedCellId={canvasSelectedCellId}
                    highlightedCellId={cellStateOverlayHighlightedCellId}
                    racks={visibleRacks}
                    primarySelectedRackId={cellStateOverlayPrimarySelectedRackId}
                    selectedRackActiveLevel={selectedRackActiveLevelIndex}
                    publishedCellsById={publishedCellsById}
                    publishedCellsByStructure={publishedCellsByStructure}
                    showFocusedFullAddress={
                      showCellStateOverlayFocusedFullAddress
                    }
                    isActivelyPanning={isPanning}
                  />
                )}

                {shouldShowPickingPlanningOverlay && (
                  <PickingRouteOverlayLayer
                    anchors={pickingPlanningRouteAnchors}
                  />
                )}
              </Layer>

              {/* ── Marquee selection overlay (topmost, non-interactive) ── */}
              <Layer name="marquee-layer" listening={false}>
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
