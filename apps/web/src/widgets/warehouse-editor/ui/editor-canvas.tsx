import { useEffect, useMemo, useRef, useState } from 'react';
import type { FloorWorkspace } from '@wos/domain';
import { Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import {
  useActiveTask,
  useActiveStorageWorkflow,
  useCanvasZoom,
  useCancelPlacementInteraction,
  useCreateFreeWall,
  useCreateRack,
  useDeleteWall,
  useCreateZone,
  useClearSelection,
  useDeleteZone,
  useEditorMode,
  useEditorSelection,
  useInteractionScope,
  useClearHighlightedCellIds,
  useHoveredRackId,
  useIsLayoutEditable,
  useSelectedCellId,
  useSelectedRackActiveLevel,
  useSelectedRackFocus,
  useSelectedZoneId,
  useSelectedWallId,
  useSetPlacementMoveTargetCellId,
  useSelectedRackId,
  useSetSelectedRackId,
  useSetSelectedWallId,
  useSetSelectedZoneId,
  useSelectedRackIds,
  useSetCanvasZoom,
  useSetEditorMode,
  useSetHoveredRackId,
  useHighlightedCellIds,
  useSetHighlightedCellIds,
  useSetSelectedCellId,
  useSetSelectedRackSide,
  useSetSelectedRackIds,
  useToggleRackSelection,
  useUpdateRackPosition,
  useUpdateWallGeometry,
  useUpdateZoneRect,
  useMinRackDistance,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import {
  GRID_SIZE,
  isRackInViewport,
  MAJOR_GRID_SIZE,
  MINOR_GRID_ZOOM_THRESHOLD
} from '@/entities/layout-version/lib/canvas-geometry';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { CanvasHud } from './canvas-hud';
import { RackLayer } from './rack-layer';
import { SnapGuides } from './shapes/snap-guides';
import { useCanvasSceneModel } from './use-canvas-scene-model';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';
import { useCanvasStageInteractions } from './use-canvas-stage-interactions';
import { useCanvasViewportController } from './use-canvas-viewport-controller';
import { WallLayer } from './wall-layer';
import { ZoneLayer } from './zone-layer';

export function EditorCanvas({
  workspace,
  onAddRack: _onAddRack,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onOpenInspector: () => void;
}) {
  const zoom = useCanvasZoom();
  const viewMode = useViewMode();
  const editorMode = useEditorMode();
  const layoutDraft = useWorkspaceLayout(workspace);
  const isLayoutEditable = useIsLayoutEditable();
  const selectedRackIds = useSelectedRackIds();
  const selectedRackId = useSelectedRackId();
  const selectedRackFocus = useSelectedRackFocus();
  const selectedRackActiveLevel = useSelectedRackActiveLevel();
  const selectedCellId = useSelectedCellId();
  const selection = useEditorSelection();
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

  const isViewMode = viewMode === 'view';
  // In View and Storage mode the published rack tree must be
  // used as the source for RackCells so that rackId/faceId/sectionId/levelId
  // in the lookup key match the keys in publishedCellsByStructure.
  // publishedCells is always fetched from the published layout version; the
  // active draft always has fresh UUIDs after create_layout_draft(), causing a
  // permanent identity mismatch when the draft layout is used instead.
  // Fall back to the draft tree when no published version exists; interaction
  // rights still come from viewMode, not from the selected data source.
  const placementLayout = isViewMode || viewMode === 'storage'
    ? (workspace?.latestPublished ?? workspace?.activeDraft ?? null)
    : null;
  const racks = useMemo(() => {
    const layout = placementLayout ?? layoutDraft;
    return layout ? layout.rackIds.map((id) => layout.racks[id]) : [];
  }, [placementLayout, layoutDraft]);

  const stageRef = useRef<Konva.Stage | null>(null);

  const [snapGuides, setSnapGuides] = useState<Array<{ type: 'x' | 'y'; position: number }>>([]);

  const {
    containerRef,
    viewport,
    canvasOffset,
    isPanning,
    handleZoom
  } = useCanvasViewportController({
    autoFitRacks: racks,
    setCanvasZoom,
    viewMode,
    zoom
  });
  const visibleRacks = useMemo(
    () => racks.filter((rack) => isRackInViewport(rack, viewport, canvasOffset, zoom)),
    [racks, viewport, canvasOffset, zoom]
  );
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
  const selectedRackIdsRef = useRef(selectedRackIds);
  selectedRackIdsRef.current = selectedRackIds;
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
    viewport
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
      const empty = { v: [] as number[], h: [] as number[], startX: 0, endX: 0, startY: 0, endY: 0 };
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
        cursor: isPanning
          ? 'grabbing'
          : isLayoutDrawToolActive
            ? 'crosshair'
            : 'default',
        background: isPlacing ? '#f0fdfe' : isDrawingZone ? '#f0fdf4' : isDrawingWall ? '#fef9f0' : '#f1f5f9'
      }}
    >
      {!layoutDraft && (
        <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
            shouldShowStorageCellBar={shouldShowStorageCellBar}
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
                {gridLineData.minor && gridLineData.minor.v.map((x) => (
                  <Line
                    key={`mn-v-${x}`}
                    points={[x, gridLineData.minor!.startY, x, gridLineData.minor!.endY]}
                    stroke={isPlacing ? '#a5f3fc' : '#e2e8f0'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.6}
                  />
                ))}
                {gridLineData.minor && gridLineData.minor.h.map((y) => (
                  <Line
                    key={`mn-h-${y}`}
                    points={[gridLineData.minor!.startX, y, gridLineData.minor!.endX, y]}
                    stroke={isPlacing ? '#a5f3fc' : '#e2e8f0'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.6}
                  />
                ))}
                {/* Major grid: 5 m lines — always visible */}
                {gridLineData.major.v.map((x) => (
                  <Line
                    key={`mj-v-${x}`}
                    points={[x, gridLineData.major.startY, x, gridLineData.major.endY]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.7}
                  />
                ))}
                {gridLineData.major.h.map((y) => (
                  <Line
                    key={`mj-h-${y}`}
                    points={[gridLineData.major.startX, y, gridLineData.major.endX, y]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.7}
                  />
                ))}
                {/* Origin marker at world (0, 0) */}
                <Line points={[-14, 0, 14, 0]} stroke="#94a3b8" strokeWidth={1.5} strokeScaleEnabled={false} opacity={0.8} />
                <Line points={[0, -14, 0, 14]} stroke="#94a3b8" strokeWidth={1.5} strokeScaleEnabled={false} opacity={0.8} />
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
                minRackDistance={minRackDistance}
                moveSourceCellId={moveSourceCellId}
                moveSourceRackId={moveSourceRackId}
                occupiedCellIds={occupiedCellIds}
                publishedCellsByStructure={publishedCellsByStructure}
                primarySelectedRackId={selectedRackId}
                rackLookup={layoutDraft.racks}
                racks={visibleRacks}
                selectedRackActiveLevel={selectedRackActiveLevel}
                selectedRackIds={selectedRackIds}
                setHighlightedCellIds={setHighlightedCellIds}
                setHoveredRackId={setHoveredRackId}
                setPlacementMoveTargetCellId={setPlacementMoveTargetCellId}
                setSelectedCellId={setSelectedCellId}
                setSelectedRackId={setSelectedRackId}
                setSelectedRackIds={setSelectedRackIds}
                setSnapGuides={setSnapGuides}
                toggleRackSelection={toggleRackSelection}
                updateRackPosition={updateRackPosition}
              />

              {/* ── Marquee selection overlay (topmost, non-interactive) ── */}
              <Layer listening={false}>
                {marquee && (
                  <Rect
                    x={Math.min(marquee.x1, marquee.x2)}
                    y={Math.min(marquee.y1, marquee.y2)}
                    width={Math.abs(marquee.x2 - marquee.x1)}
                    height={Math.abs(marquee.y2 - marquee.y1)}
                    fill="rgba(59,130,246,0.08)"
                    stroke="#3b82f6"
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
