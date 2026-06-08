/**
 * RackLayer with child-level attribution diagnostics.
 *
 * DIAGNOSTICS USAGE:
 * 1. Enable in DevTools console:
 *    window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ = {
 *      enabled: true,
 *      // ... other properties (use getCanvasDiagnosticsFlags() for defaults)
 *    }
 *    window.__WOS_RACK_LAYER_CHILD_PROFILING__ = { enabled: true, childMetrics: {} }
 *
 * 2. Navigate to route or trigger canvas activity
 *
 * 3. Get report:
 *    import { getRackLayerChildProfilingReport } from './canvas-diagnostics'
 *    const { summary, childMetrics } = getRackLayerChildProfilingReport()
 *    console.log(summary)
 *
 * 4. Analyze results:
 *    - Which child (RackBody, RackSections, RackCells, SelectionOverlayLayer) is expensive?
 *    - Does RackBody re-render when only occupiedCellIds_id changes? (indicates static geometry issue)
 *    - Does RackCells re-render on cellRuntimeById_id? (expected for runtime state)
 *
 * Each child is wrapped with React.Profiler to measure:
 * - renderCount: number of times this child re-rendered
 * - actualDurationMs: total/max/last render time
 * - propChanges: which reference-identity props changed (racks_id, cellRuntimeById_id, occupiedCellIds_id, etc.)
 *
 * This helps identify the target for the next optimization PR without first implementing
 * visibleRacks stabilization or splitting RackLayer.
 */

import type {
  Cell,
  OperationsCellRuntime,
  Rack,
  RackFace
} from '@wos/domain';
import { memo, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { FastLayer, Group, Layer, Rect } from 'react-konva';
import {
  getRackGeometry,
  WORLD_SCALE
} from '@/entities/layout-version/lib/canvas-geometry';
import { getSnapPosition } from '@/entities/layout-version/lib/rack-spacing';
import { collectRackSemanticLevels } from '@/warehouse/editor/model/storage-level-mapping';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { getRackLabelRevealPolicy } from './shapes/rack-label-reveal-policy';
import {
  getEffectiveRackFaceB,
  resolveCellIdFromFacePoint
} from './shapes/rack-cell-geometry';
import { SelectionOverlayLayer } from './shapes/selection-overlay-layer';
import { RackSections } from './shapes/rack-sections';
import {
  recordCanvasForceRenderReasons,
  recordCanvasComponentRender,
  recordCanvasKonvaLayerDraw,
  recordCanvasRackLayerNodeCount,
  recordCanvasRackLayerSnapshot,
  recordCanvasRackLayerMount,
  recordCanvasRackLayerUnmount,
  recordCanvasRackLayerDraw,
  recordRoutePreviewAppPhaseMark,
  refId,
  type CanvasDiagnosticsFlags,
  type CanvasForceRenderReason
} from './canvas-diagnostics';
import {
  RackLayerChildProfiler,
  RackLayerProfilingContextProvider,
  type RackLayerRefIdentityChanges
} from './rack-layer-child-profiler';
import {
  isCanvasFullDetailRenderMode,
  isCanvasInteractionRenderMode,
  type CanvasRenderMode
} from './canvas-render-mode';
import { readStorageDebugFlagsFromWindow } from './storage-debug-flags';

type SnapGuide = {
  type: 'x' | 'y';
  position: number;
};

const EMPTY_CELL_IDS = new Set<string>();

function getFirstCellId(cellIds: Set<string>): string | null {
  for (const cellId of cellIds) {
    return cellId;
  }
  return null;
}

function createForceRenderReasonCounts(): Record<CanvasForceRenderReason, number> {
  return {
    none: 0,
    selection: 0,
    locate: 0,
    workflow: 0,
    debug: 0
  };
}

type LocalPoint = { x: number; y: number };

function countKonvaNodeTree(node: Konva.Node): number {
  const container = node as Konva.Container;
  const children =
    typeof container.getChildren === 'function' ? container.getChildren() : [];
  let count = 1;
  children.forEach((child) => {
    count += countKonvaNodeTree(child);
  });
  return count;
}

function resolveCellIdFromFaceAtPoint({
  face,
  rackId,
  totalWidth,
  bandY,
  bandH,
  activeLevelIndex,
  semanticLevels,
  point,
  publishedCellsByStructure
}: {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  activeLevelIndex: number | null;
  semanticLevels: number[];
  point: LocalPoint;
  publishedCellsByStructure: Map<string, Cell>;
}): string | null {
  return resolveCellIdFromFacePoint({
    activeLevelIndex,
    bandH,
    bandY,
    face,
    point,
    publishedCellsByStructure,
    rackId,
    semanticLevels,
    totalWidth
  });
}

function resolveCellIdFromRackPoint({
  rack,
  point,
  activeLevelIndex,
  publishedCellsByStructure
}: {
  rack: Rack;
  point: LocalPoint;
  activeLevelIndex: number | null;
  publishedCellsByStructure: Map<string, Cell>;
}): string | null {
  const geometry = getRackGeometry(rack);
  const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
  if (!faceA) return null;
  const effectiveFaceB = getEffectiveRackFaceB(rack);
  const semanticLevels = collectRackSemanticLevels(rack);

  const cellIdInFaceA = resolveCellIdFromFaceAtPoint({
    face: faceA,
    rackId: rack.id,
    totalWidth: geometry.faceAWidth,
    bandY: 0,
    bandH: geometry.isPaired ? geometry.spineY : geometry.height,
    activeLevelIndex,
    semanticLevels,
    point,
    publishedCellsByStructure
  });
  if (cellIdInFaceA) return cellIdInFaceA;

  if (geometry.isPaired && effectiveFaceB) {
    return resolveCellIdFromFaceAtPoint({
      face: effectiveFaceB,
      rackId: rack.id,
      totalWidth: geometry.faceBWidth,
      bandY: geometry.spineY,
      bandH: geometry.height - geometry.spineY,
      activeLevelIndex,
      semanticLevels,
      point,
      publishedCellsByStructure
    });
  }

  return null;
}

type RackLayerProps = {
  activeCellRackId: string | null;
  canSelectCells: boolean;
  canSelectRack: boolean;
  diagnosticsFlags: CanvasDiagnosticsFlags;
  diagnosticsViewport: {
    canvasOffset: { x: number; y: number };
    viewport: { width: number; height: number };
    zoom: number;
  };
  isActivelyPanning?: boolean;
  labelsDeferred?: boolean;
  renderMode?: CanvasRenderMode;
  renderSelectionOverlay?: boolean;
  canvasSelectedCellId: string | null;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  clearHighlightedCellIds: () => void;
  highlightedCellIds: Set<string>;
  hoveredRackId: string | null;
  isLayoutEditable: boolean;
  isLayoutMode: boolean;
  isPlacing: boolean;
  isRackPassiveScopeActive: boolean;
  isStorageMode: boolean;
  isViewMode: boolean;
  isWorkflowScope: boolean;
  lod: 0 | 1 | 2;
  zoom: number;
  minRackDistance: number;
  moveSourceCellId: string | null;
  moveSourceRackId: string | null;
  temporaryLocateTargetCellId: string | null;
  occupiedCellIds: Set<string>;
  publishedCellsById: Map<string, Cell>;
  publishedCellsByStructure: Map<string, Cell>;
  primarySelectedRackId: string | null;
  rackLookup: Record<string, Rack>;
  racks: Rack[];
  selectedRackActiveLevel: number | null;
  selectedRackIds: string[];
  setHighlightedCellIds: (cellIds: string[]) => void;
  setHoveredRackId: (rackId: string | null) => void;
  setPlacementMoveTargetCellId: (cellId: string | null) => void;
  setSelectedCellId: (cellId: string | null) => void;
  setSelectedRackId: (rackId: string | null) => void;
  setSelectedRackIds: (rackIds: string[]) => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  toggleRackSelection: (rackId: string) => void;
  updateRackPosition: (rackId: string, x: number, y: number) => void;
  onV2StorageCellSelect?: (params: { cellId: string; rackId: string }) => void;
  onV2StorageRackSelect?: (params: { rackId: string }) => void;
};

export const RackLayer = memo(function RackLayer({
  activeCellRackId,
  canSelectCells,
  canSelectRack,
  diagnosticsFlags,
  diagnosticsViewport,
  isActivelyPanning = false,
  labelsDeferred = false,
  renderMode = 'full',
  renderSelectionOverlay = true,
  canvasSelectedCellId,
  cellRuntimeById,
  clearHighlightedCellIds,
  highlightedCellIds,
  hoveredRackId,
  isLayoutEditable,
  isLayoutMode,
  isPlacing,
  isRackPassiveScopeActive,
  isStorageMode,
  isViewMode,
  isWorkflowScope,
  lod,
  zoom,
  minRackDistance,
  moveSourceCellId,
  moveSourceRackId,
  temporaryLocateTargetCellId,
  occupiedCellIds,
  publishedCellsById,
  publishedCellsByStructure,
  primarySelectedRackId,
  rackLookup,
  racks,
  selectedRackActiveLevel,
  selectedRackIds,
  setHighlightedCellIds,
  setHoveredRackId,
  setPlacementMoveTargetCellId,
  setSelectedCellId,
  setSelectedRackId,
  setSelectedRackIds,
  setSnapGuides,
  toggleRackSelection,
  updateRackPosition,
  onV2StorageCellSelect,
  onV2StorageRackSelect,
}: RackLayerProps) {
  const isInteractionMode = isCanvasInteractionRenderMode(renderMode);
  const isInteractionSkeleton = renderMode === 'interaction-skeleton';
  const isRestoreBase = renderMode === 'restore-base';
  const isRestoreOverlays =
    renderMode === 'restore-overlays' || renderMode === 'restore-labels';
  const labelRevealPolicy = getRackLabelRevealPolicy({ lod, zoom });
  const labelsEnabled =
    !labelsDeferred &&
    isCanvasFullDetailRenderMode(renderMode) &&
    diagnosticsFlags.labels === 'normal';
  const hitTestEnabled =
    (renderMode === 'full' || isRestoreOverlays) &&
    diagnosticsFlags.hitTest === 'normal';
  const renderCells =
    !isInteractionSkeleton && diagnosticsFlags.cells !== 'off';
  const overlaysEnabled =
    (renderMode === 'full' || isRestoreOverlays) &&
    diagnosticsFlags.cellOverlays !== 'off';
  const selectionOverlayEnabled =
    overlaysEnabled && diagnosticsFlags.cellOverlays === 'normal';
  const singleOverlayHighlightedCellId =
    selectionOverlayEnabled &&
    canvasSelectedCellId !== null &&
    highlightedCellIds.size === 1 &&
    highlightedCellIds.has(canvasSelectedCellId)
      ? canvasSelectedCellId
      : null;
  const baseHighlightedCellIds =
    singleOverlayHighlightedCellId !== null
      ? EMPTY_CELL_IDS
      : highlightedCellIds;
  const highlightedCellFirstId = getFirstCellId(highlightedCellIds);
  const locateTargetRackId =
    temporaryLocateTargetCellId !== null
      ? (publishedCellsById.get(temporaryLocateTargetCellId)?.rackId ?? null)
      : null;
  const RackLayerComponent =
    diagnosticsFlags.rackLayerRenderer === 'fast-layer' ? FastLayer : Layer;
  const layerRef = useRef<Konva.Layer | null>(null);
  const prevRefIdsRef = useRef<{
    racks_id: number;
    cellRuntimeById_id: number;
    occupiedCellIds_id: number;
    publishedCellsByStructure_id: number;
    publishedCellsById_id: number;
  } | null>(null);

  const currentRefIds = {
    racks_id: refId(racks),
    cellRuntimeById_id: refId(cellRuntimeById),
    occupiedCellIds_id: refId(occupiedCellIds),
    publishedCellsByStructure_id: refId(publishedCellsByStructure),
    publishedCellsById_id: refId(publishedCellsById)
  };

  const refIdentityChanges: RackLayerRefIdentityChanges = {
    racks_id: !prevRefIdsRef.current || prevRefIdsRef.current.racks_id !== currentRefIds.racks_id,
    cellRuntimeById_id:
      !prevRefIdsRef.current || prevRefIdsRef.current.cellRuntimeById_id !== currentRefIds.cellRuntimeById_id,
    occupiedCellIds_id:
      !prevRefIdsRef.current || prevRefIdsRef.current.occupiedCellIds_id !== currentRefIds.occupiedCellIds_id,
    publishedCellsByStructure_id:
      !prevRefIdsRef.current || prevRefIdsRef.current.publishedCellsByStructure_id !== currentRefIds.publishedCellsByStructure_id,
    publishedCellsById_id:
      !prevRefIdsRef.current || prevRefIdsRef.current.publishedCellsById_id !== currentRefIds.publishedCellsById_id
  };

  prevRefIdsRef.current = currentRefIds;

  const forceRenderReasonCounts = createForceRenderReasonCounts();
  for (const rack of racks) {
    if (locateTargetRackId === rack.id) {
      forceRenderReasonCounts.locate += 1;
    } else if (moveSourceRackId === rack.id) {
      forceRenderReasonCounts.workflow += 1;
    } else {
      forceRenderReasonCounts.none += 1;
    }
  }
  recordCanvasForceRenderReasons(forceRenderReasonCounts);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const diagnosticLayer = layer as Konva.Layer & {
      __wosDrawDiagnosticsWrapped?: boolean;
    };
    if (!diagnosticLayer.__wosDrawDiagnosticsWrapped) {
      const originalDraw = layer.draw.bind(layer);
      const originalBatchDraw = layer.batchDraw.bind(layer);
      layer.draw = (...args: Parameters<Konva.Layer['draw']>) => {
        recordCanvasKonvaLayerDraw('draw', 'rack-base-layer');
        recordCanvasRackLayerDraw();
        recordRoutePreviewAppPhaseMark('rack-layer:first-draw-complete', {
          onceKey: 'rack-layer:first-draw-complete'
        });
        return originalDraw(...args);
      };
      layer.batchDraw = (...args: Parameters<Konva.Layer['batchDraw']>) => {
        recordCanvasKonvaLayerDraw('batchDraw', 'rack-base-layer');
        recordCanvasRackLayerDraw();
        recordRoutePreviewAppPhaseMark('rack-layer:first-batch-draw-complete', {
          onceKey: 'rack-layer:first-batch-draw-complete'
        });
        return originalBatchDraw(...args);
      };
      diagnosticLayer.__wosDrawDiagnosticsWrapped = true;
    }

    recordCanvasRackLayerNodeCount(countKonvaNodeTree(layer));
  });

  recordCanvasComponentRender({
    component: 'RackLayer',
    propsKeys: [
      'rackIds',
      'zoom',
      'activeCellRackId',
      'primarySelectedRackId',
      'selectedRackActiveLevel',
      'selectedRackIds',
      'hoveredRackId',
      'canvasSelectedCellId',
      'canSelectCells',
      'canSelectRack',
      'isLayoutEditable',
      'isLayoutMode',
      'isStorageMode',
      'isViewMode',
      'lod',
      'diagnosticsLabels',
      'diagnosticsHitTest',
      'diagnosticsCells',
      'diagnosticsCellOverlays',
      'diagnosticsCulling',
      'diagnosticsRackLayerRenderer',
      'diagnosticsRackBodyShell',
      'isActivelyPanning',
      'labelsDeferred',
      'renderMode',
      'renderSelectionOverlay',
      'canvasOffsetX',
      'canvasOffsetY',
      'viewportWidth',
      'viewportHeight',
      'highlightedCellCount',
      'highlightedCellFirstId',
      'overlayHighlightedCellCount',
      'baseHighlightedCellCount',
      'racks_id',
      'cellRuntimeById_id',
      'occupiedCellIds_id',
      'publishedCellsByStructure_id',
      'publishedCellsById_id'
    ],
    snapshot: {
      rackIds: racks.map((rack) => rack.id).join('|'),
      zoom,
      activeCellRackId,
      primarySelectedRackId,
      selectedRackActiveLevel,
      selectedRackIds: selectedRackIds.join('|'),
      hoveredRackId,
      canvasSelectedCellId,
      canSelectCells,
      canSelectRack,
      isLayoutEditable,
      isLayoutMode,
      isStorageMode,
      isViewMode,
      lod,
      diagnosticsLabels: diagnosticsFlags.labels,
      diagnosticsHitTest: diagnosticsFlags.hitTest,
      diagnosticsCells: diagnosticsFlags.cells,
      diagnosticsCellOverlays: diagnosticsFlags.cellOverlays,
      diagnosticsCulling: diagnosticsFlags.enableProductionCellCulling,
      diagnosticsRackLayerRenderer: diagnosticsFlags.rackLayerRenderer,
      diagnosticsRackBodyShell: diagnosticsFlags.rackBodyShell ?? 'normal',
      isActivelyPanning,
      labelsDeferred,
      renderMode,
      renderSelectionOverlay,
      canvasOffsetX: diagnosticsViewport.canvasOffset.x,
      canvasOffsetY: diagnosticsViewport.canvasOffset.y,
      viewportWidth: diagnosticsViewport.viewport.width,
      viewportHeight: diagnosticsViewport.viewport.height,
      highlightedCellCount: highlightedCellIds.size,
      highlightedCellFirstId,
      overlayHighlightedCellCount: singleOverlayHighlightedCellId ? 1 : 0,
      baseHighlightedCellCount: baseHighlightedCellIds.size,
      // Reference-identity tokens: change when the object reference changes
      // even if the logical content is the same (detects array/Map/Set churn).
      racks_id: refId(racks),
      cellRuntimeById_id: refId(cellRuntimeById),
      occupiedCellIds_id: refId(occupiedCellIds),
      publishedCellsByStructure_id: refId(publishedCellsByStructure),
      publishedCellsById_id: refId(publishedCellsById)
    }
  });

  // Debug-only isolation flags read from URL (?debug=1&disableRackCells=1 etc.)
  const storageDebugFlags = readStorageDebugFlagsFromWindow();

  const disableRackBodies = storageDebugFlags.disableRackBodies;
  const disableRackCells = storageDebugFlags.disableRackCells;
  const disableRackRuntimeVisuals = storageDebugFlags.disableRackRuntimeVisuals;

  // When disableRackRuntimeVisuals is active, suppress runtime cell data
  // so visual state resolver sees no runtime statuses (reserved, pick_active,
  // quarantined) and produces only base/occupied fills with no runtime
  // truth markers.
  const effectiveCellRuntimeById =
    disableRackRuntimeVisuals
      ? new Map<string, OperationsCellRuntime>()
      : cellRuntimeById;

  // Compute bounded snapshot counts for RackLayer diagnostics
  const renderedCellCount = racks.reduce((sum, rack) => {
    const faceA = rack.faces.find((f) => f.side === 'A');
    if (!faceA) return sum;
    let count = 0;
    for (const section of faceA.sections) {
      for (const level of section.levels) {
        count += level.slotCount;
      }
    }
    return sum + count;
  }, 0);

  let reservedCount = 0;
  let pickActiveCount = 0;
  let occupiedCount = 0;
  let emptyCount = 0;
  let exceptionCount = 0;
  let otherStatusCount = 0;
  if (!disableRackRuntimeVisuals) {
    for (const [_cellId, runtime] of cellRuntimeById) {
      switch (runtime.status) {
        case 'reserved': reservedCount++; break;
        case 'pick_active': pickActiveCount++; break;
        case 'stocked': occupiedCount++; break;
        case 'empty': emptyCount++; break;
        case 'quarantined': exceptionCount++; break;
        default: otherStatusCount++; break;
      }
    }
  }

  recordCanvasRackLayerSnapshot({
    renderedRackCount: racks.length,
    renderedCellCount,
    rackBodyNodeCount: disableRackBodies ? 0 : racks.length,
    rackCellNodeCount: disableRackCells ? 0 : racks.length * 2,
    runtimeVisualNodeCount: disableRackRuntimeVisuals ? 0 : cellRuntimeById.size,
    statusCounts: {
      reserved: reservedCount,
      pick_active: pickActiveCount,
      occupied: occupiedCount,
      empty: emptyCount,
      exception: exceptionCount,
      other: otherStatusCount
    },
    visibleRackCount: racks.length,
    effectiveLod: lod,
    hitTestEnabled,
    cacheEnabled: diagnosticsFlags.rackBodyShell === 'cached'
  });

  useEffect(() => {
    recordCanvasRackLayerMount();
    return () => { recordCanvasRackLayerUnmount(); };
  }, []);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!isLayoutEditable) return;

    const node = event.target;
    const rack = rackLookup[rackId];
    if (!rack || rack.isLocked) {
      return;
    }

    // node.x() / node.offsetX() are canvas pixels; convert to metres
    const xM = (node.x() - node.offsetX()) / WORLD_SCALE;
    const yM = (node.y() - node.offsetY()) / WORLD_SCALE;

    const otherRacks = Object.values(rackLookup).filter((item) => item.id !== rackId);
    // getSnapPosition operates in metres; threshold 0.1 m
    const snapInfo = getSnapPosition(rack, xM, yM, otherRacks, minRackDistance);

    if (snapInfo.snappedToX || snapInfo.snappedToY) {
      const finalXM = snapInfo.snappedToX ? snapInfo.snappedX : xM;
      const finalYM = snapInfo.snappedToY ? snapInfo.snappedY : yM;
      setSnapGuides(
        [
          // snap guide positions must be canvas pixels for Konva rendering
          snapInfo.snappedToX && { type: 'x' as const, position: snapInfo.snappedX * WORLD_SCALE },
          snapInfo.snappedToY && { type: 'y' as const, position: snapInfo.snappedY * WORLD_SCALE }
        ].filter(Boolean) as SnapGuide[]
      );
      updateRackPosition(rackId, finalXM, finalYM);
    } else {
      setSnapGuides([]);
      updateRackPosition(rackId, xM, yM);
    }
  };

  /**
   * Rack press handler — defined outside the map (rackId is passed as param).
   * In storage mode: uses V2 callback when provided, else falls back to legacy.
   */
  const handleRackPress = (
    rack: Rack,
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    // Defensive guard: explicit cell clicks must not be downgraded into rack clicks.
    // RackCells already cancel bubble, but this keeps rack-first/cell-second semantics stable.
    if ((event as unknown as { cancelBubble?: boolean }).cancelBubble) return;
    event.cancelBubble = true;
    if (!canSelectRack) return;

    if (!isLayoutMode) {
      clearHighlightedCellIds();
      if (isStorageMode) {
        const pointer = event.currentTarget.getRelativePointerPosition();
        const resolvedCellId =
          hitTestEnabled && canSelectCells && pointer
            ? resolveCellIdFromRackPoint({
                rack,
                point: pointer,
                activeLevelIndex: rack.id === primarySelectedRackId ? selectedRackActiveLevel : 0,
                publishedCellsByStructure
              })
            : null;
        if (resolvedCellId) {
          if (isWorkflowScope) {
            setPlacementMoveTargetCellId(resolvedCellId);
            return;
          }
          onV2StorageCellSelect?.({ cellId: resolvedCellId, rackId: rack.id });
          return;
        }
        onV2StorageRackSelect?.({ rackId: rack.id });
      } else {
        setSelectedRackIds([rack.id]);
      }
      return;
    }

    const pointerEvent = event.evt as unknown as PointerEvent;
    if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
      toggleRackSelection(rack.id);
    } else {
      setSelectedRackId(rack.id);
    }
  };

  // NOTE: handleCellClick is defined per-rack inside racks.map() so that it
  // has access to rack.id for the V2 onV2StorageCellSelect({ cellId, rackId }) call.
  // This is necessary because RackCells.onCellClick only receives cellId.

  return (
    <RackLayerProfilingContextProvider refIdentityChanges={refIdentityChanges}>
      <RackLayerComponent
        ref={layerRef}
        name="rack-base-layer"
        listening={hitTestEnabled}
      >
        {racks.map((rack) => {
        const geometry = getRackGeometry(rack);
        const isSelected = overlaysEnabled && selectedRackIds.includes(rack.id);
        const forceRenderReason: CanvasForceRenderReason =
          locateTargetRackId === rack.id
            ? 'locate'
            : moveSourceRackId === rack.id
              ? 'workflow'
              : 'none';
        const shouldForceRenderAllCells = forceRenderReason !== 'none';
        const isHovered = overlaysEnabled && hoveredRackId === rack.id;
        const isRackPassive =
          overlaysEnabled &&
          isRackPassiveScopeActive &&
          !isSelected &&
          activeCellRackId !== rack.id &&
          moveSourceRackId !== rack.id;
        const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
        const effectiveFaceB = getEffectiveRackFaceB(rack);
        const semanticLevels = collectRackSemanticLevels(rack);

        // Per-rack cell click handler: closure captures rack.id for V2 focus store call.
        const handleCellClick = (cellId: string, anchor: { x: number; y: number }) => {
          void anchor;
          if (isStorageMode) {
            if (isWorkflowScope) {
              setPlacementMoveTargetCellId(cellId);
              return;
            }
            onV2StorageCellSelect?.({ cellId, rackId: rack.id });
            return;
          }
          if (isViewMode) {
            setSelectedCellId(cellId);
            setHighlightedCellIds([cellId]);
          }
        };

        return (
          <Group
            key={rack.id}
            x={geometry.x + geometry.centerX}
            y={geometry.y + geometry.centerY}
            offsetX={geometry.centerX}
            offsetY={geometry.centerY}
            rotation={rack.rotationDeg}
            draggable={
              renderMode === 'full' && isLayoutEditable && !isPlacing && !rack.isLocked
            }
            onMouseDown={(event) => {
              // Prevent Stage onMouseDown from starting a marquee when clicking a rack.
              event.cancelBubble = true;
            }}
            onTouchStart={(event) => {
              // Mirror onMouseDown: stop native DOM propagation so the viewport
              // controller's container-level touchstart listener doesn't start a pan
              // when the user touches a rack. Also cancel Konva bubble to match
              // the mouse path (prevents any stage-level touchstart handler).
              event.cancelBubble = true;
              event.evt.stopPropagation();
            }}
            onClick={(event) => handleRackPress(rack, event)}
            onTap={(event) => handleRackPress(rack, event)}
            onMouseEnter={() => {
              if (hitTestEnabled && canSelectRack) setHoveredRackId(rack.id);
            }}
            onMouseLeave={() => {
              if (hitTestEnabled && canSelectRack) setHoveredRackId(null);
            }}
            onDragStart={() => {
              if (isLayoutEditable && !rack.isLocked && !selectedRackIds.includes(rack.id)) {
                setSelectedRackIds([rack.id]);
              }
            }}
            onDragMove={(event) => handleDragMove(rack.id, event)}
            onDragEnd={(event) => {
              setSnapGuides([]);
              const node = event.target;
              const currentRack = rackLookup[rack.id];
              if (currentRack) {
                const geometry = getRackGeometry(currentRack);
                node.position({
                  x: geometry.x + geometry.centerX,
                  y: geometry.y + geometry.centerY
                });
              }
            }}
          >
            <RackLayerChildProfiler childName="InteractionRect" rackId={rack.id}>
              {!isInteractionMode && !isRestoreBase && (
                <Rect
                  x={0}
                  y={0}
                  width={geometry.width}
                  height={geometry.height}
                  fill="transparent"
                  wosRectRole="rack-interaction"
                />
              )}
            </RackLayerChildProfiler>

            {!disableRackBodies && (
            <RackLayerChildProfiler childName="RackBody" rackId={rack.id}>
              <RackBody
                geometry={geometry}
                displayCode={rack.displayCode}
                rotationDeg={rack.rotationDeg}
                isSelected={isSelected}
                isHovered={isHovered}
                isPassive={isRackPassive}
                showRackCode={labelsEnabled && labelRevealPolicy.showRackCode}
                rackCodeProminence={labelRevealPolicy.rackCodeProminence}
                rackCodePlacement={labelRevealPolicy.rackCodePlacement}
                disableStrokes={!overlaysEnabled}
                isActivelyPanning={isActivelyPanning || isInteractionSkeleton}
                shellRendering={diagnosticsFlags.rackBodyShell ?? 'normal'}
              />
            </RackLayerChildProfiler>
            )}

            {lod >= 1 && faceA && (
              <RackLayerChildProfiler childName="RackSections" rackId={rack.id}>
                <RackSections
                  geometry={geometry}
                  faceA={faceA}
                  faceB={geometry.isPaired ? effectiveFaceB : null}
                  isSelected={isSelected}
                  isPassive={isRackPassive}
                  showFaceToken={labelsEnabled && labelRevealPolicy.showFaceToken}
                  showSectionNumbers={labelsEnabled && labelRevealPolicy.showSectionNumbers}
                  faceTokenProminence={labelRevealPolicy.faceTokenProminence}
                  sectionNumberProminence={labelRevealPolicy.sectionNumberProminence}
                  rackRotationDeg={rack.rotationDeg}
                  disableStrokes={!overlaysEnabled}
                  isActivelyPanning={isActivelyPanning || isInteractionSkeleton}
                />
              </RackLayerChildProfiler>
            )}

            {!disableRackCells && renderCells && (lod >= 2 || (isViewMode && lod >= 1)) && faceA && (
              <RackLayerChildProfiler childName="RackCells" rackId={rack.id}>
                <RackCells
                  geometry={geometry}
                  rackId={rack.id}
                  faceA={faceA}
                  faceB={geometry.isPaired ? effectiveFaceB : null}
                  isSelected={isSelected}
                  activeLevelIndex={rack.id === primarySelectedRackId ? selectedRackActiveLevel : 0}
                  semanticLevels={semanticLevels}
                  publishedCellsByStructure={publishedCellsByStructure}
                  occupiedCellIds={occupiedCellIds}
                  cellRuntimeById={effectiveCellRuntimeById}
                  highlightedCellIds={
                    overlaysEnabled ? baseHighlightedCellIds : EMPTY_CELL_IDS
                  }
                  diagnosticsFlags={diagnosticsFlags}
                  diagnosticsViewport={diagnosticsViewport}
                  isActivelyPanning={isActivelyPanning}
                  renderMode={renderMode}
                  forceRenderAllCells={shouldForceRenderAllCells}
                  isInteractive={hitTestEnabled && canSelectCells}
                  isWorkflowScope={isWorkflowScope}
                  isPassive={isRackPassive}
                  selectedCellId={
                    selectionOverlayEnabled
                      ? null
                      : overlaysEnabled
                        ? canvasSelectedCellId
                        : null
                  }
                  locateTargetCellId={
                    overlaysEnabled ? temporaryLocateTargetCellId : null
                  }
                  workflowSourceCellId={overlaysEnabled ? moveSourceCellId : null}
                  onCellClick={handleCellClick}
                  showCellNumbers={labelsEnabled && labelRevealPolicy.showCellNumbers}
                  cellNumberProminence={labelRevealPolicy.cellNumberProminence}
                  showFocusedFullAddress={labelsEnabled && labelRevealPolicy.showFocusedFullAddress}
                  rackRotationDeg={rack.rotationDeg}
                />
              </RackLayerChildProfiler>
            )}
          </Group>
        );
      })}
      {selectionOverlayEnabled && renderSelectionOverlay && (
        <RackLayerChildProfiler childName="SelectionOverlayLayer">
          <SelectionOverlayLayer
            selectedCellId={canvasSelectedCellId}
            highlightedCellId={singleOverlayHighlightedCellId}
            racks={racks}
            primarySelectedRackId={primarySelectedRackId}
            selectedRackActiveLevel={selectedRackActiveLevel}
            publishedCellsById={publishedCellsById}
            publishedCellsByStructure={publishedCellsByStructure}
            showFocusedFullAddress={
              labelsEnabled && labelRevealPolicy.showFocusedFullAddress
            }
            isActivelyPanning={isActivelyPanning}
          />
        </RackLayerChildProfiler>
      )}
      </RackLayerComponent>
    </RackLayerProfilingContextProvider>
  );
});
