import { useEffect, useMemo, useRef, useState } from 'react';
import type { Cell, FloorWorkspace, Wall, Zone } from '@wos/domain';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import {
  Minus,
  Plus,
  SlidersHorizontal
} from 'lucide-react';
import {
  useActiveStorageWorkflow,
  useCanvasZoom,
  useCancelPlacementInteraction,
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
} from '@/entities/layout-version/model/editor-selectors';
import type { RackSideFocus } from '@/entities/layout-version/model/editor-types';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useFloorOperationsCells } from '@/entities/location/api/use-floor-operations-cells';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { indexOccupiedCellIds } from '@/entities/cell/lib/occupied-cell-lookup';
import { indexPublishedCellsByStructure } from '@/entities/cell/lib/published-cell-lookup';
import {
  clampCanvasPosition,
  type CanvasRect,
  getCellCanvasRect,
  getCanvasInteractionLevel,
  getCanvasLOD,
  getRackCanvasRect,
  getRackGeometry,
  getWallCanvasRect,
  getZoneCanvasRect,
  GRID_SIZE,
  projectCanvasRectToViewport
} from '../lib/canvas-geometry';
import { getSnapPosition } from '../lib/rack-spacing';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import {
  ObjectLocalAffordanceBar,
  ObjectLocalAffordanceButton
} from './object-local-affordance-bar';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { RackSections } from './shapes/rack-sections';
import { SnapGuides } from './shapes/snap-guides';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';
import { useCanvasViewportController } from './use-canvas-viewport-controller';

type LayoutRackAffordanceBarProps = {
  displayCode: string;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function LayoutRackAffordanceBar({
  displayCode,
  anchorRect,
  viewport,
  onOpenInspector
}: LayoutRackAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={displayCode}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

const RACK_SIDE_HANDLE_LABELS: Record<RackSideFocus, string> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'W'
};

const RACK_SIDE_HANDLE_TITLES: Record<RackSideFocus, string> = {
  north: 'Focus north side',
  east: 'Focus east side',
  south: 'Focus south side',
  west: 'Focus west side'
};

function getRackSideHandleStyle({
  side,
  anchorRect,
  viewport
}: {
  side: RackSideFocus;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
}) {
  const viewportPadding = 8;
  const centerX = anchorRect.x + anchorRect.width / 2;
  const centerY = anchorRect.y + anchorRect.height / 2;
  const minX = viewportPadding;
  const maxX = Math.max(minX, viewport.width - viewportPadding);
  const minY = viewportPadding;
  const maxY = Math.max(minY, viewport.height - viewportPadding);

  const points: Record<RackSideFocus, { left: number; top: number; transform: string }> = {
    north: {
      left: Math.min(maxX, Math.max(minX, centerX)),
      top: Math.min(maxY, Math.max(minY, anchorRect.y)),
      transform: 'translate(-50%, -50%)'
    },
    east: {
      left: Math.min(maxX, Math.max(minX, anchorRect.x + anchorRect.width)),
      top: Math.min(maxY, Math.max(minY, centerY)),
      transform: 'translate(-50%, -50%)'
    },
    south: {
      left: Math.min(maxX, Math.max(minX, centerX)),
      top: Math.min(maxY, Math.max(minY, anchorRect.y + anchorRect.height)),
      transform: 'translate(-50%, -50%)'
    },
    west: {
      left: Math.min(maxX, Math.max(minX, anchorRect.x)),
      top: Math.min(maxY, Math.max(minY, centerY)),
      transform: 'translate(-50%, -50%)'
    }
  };

  return points[side];
}

function RackSideFocusHandles({
  anchorRect,
  viewport,
  activeSide,
  onSelectSide
}: {
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  activeSide: RackSideFocus | null;
  onSelectSide: (side: RackSideFocus) => void;
}) {
  return (
    <>
      {(['north', 'east', 'south', 'west'] as RackSideFocus[]).map((side) => {
        const isActive = activeSide === side;

        return (
          <button
            key={side}
            type="button"
            title={RACK_SIDE_HANDLE_TITLES[side]}
            onClick={() => onSelectSide(side)}
            className="pointer-events-auto absolute z-20 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold shadow-md transition-colors"
            style={{
              ...getRackSideHandleStyle({ side, anchorRect, viewport }),
              background: isActive ? 'var(--accent)' : 'var(--surface-strong)',
              borderColor: isActive ? 'var(--accent)' : 'var(--border-muted)',
              color: isActive ? '#fff' : 'var(--text-primary)'
            }}
          >
            {RACK_SIDE_HANDLE_LABELS[side]}
          </button>
        );
      })}
    </>
  );
}

type StorageCellAffordanceBarProps = {
  cell: Cell;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function StorageCellAffordanceBar({
  cell,
  anchorRect,
  viewport,
  onOpenInspector
}: StorageCellAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={cell.address.raw}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

type LayoutZoneAffordanceBarProps = {
  zone: Zone;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function LayoutZoneAffordanceBar({
  zone,
  anchorRect,
  viewport,
  onOpenInspector
}: LayoutZoneAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={zone.name}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

type LayoutWallAffordanceBarProps = {
  wall: Wall;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function LayoutWallAffordanceBar({
  wall,
  anchorRect,
  viewport,
  onOpenInspector
}: LayoutWallAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={wall.code}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

type ZoneResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
const ZONE_RESIZE_HANDLE_SIZE = 10;
const MIN_ZONE_SIZE = GRID_SIZE;
type WallEndpointHandle = 'start' | 'end';
const WALL_HANDLE_RADIUS = 6;

function getZoneResizeHandlePosition(zone: Zone, handle: ZoneResizeHandle) {
  const points: Record<ZoneResizeHandle, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    ne: { x: zone.width, y: 0 },
    sw: { x: 0, y: zone.height },
    se: { x: zone.width, y: zone.height }
  };

  return points[handle];
}

function resizeZoneFromHandle(
  zone: Zone,
  handle: ZoneResizeHandle,
  pointer: { x: number; y: number }
) {
  const snappedX = Math.round(pointer.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(pointer.y / GRID_SIZE) * GRID_SIZE;
  const right = zone.x + zone.width;
  const bottom = zone.y + zone.height;

  switch (handle) {
    case 'nw': {
      const nextX = Math.min(right - MIN_ZONE_SIZE, snappedX);
      const nextY = Math.min(bottom - MIN_ZONE_SIZE, snappedY);
      return {
        x: clampCanvasPosition(nextX),
        y: clampCanvasPosition(nextY),
        width: right - nextX,
        height: bottom - nextY
      };
    }
    case 'ne': {
      const nextRight = Math.max(zone.x + MIN_ZONE_SIZE, snappedX);
      const nextY = Math.min(bottom - MIN_ZONE_SIZE, snappedY);
      return {
        x: zone.x,
        y: clampCanvasPosition(nextY),
        width: nextRight - zone.x,
        height: bottom - nextY
      };
    }
    case 'sw': {
      const nextX = Math.min(right - MIN_ZONE_SIZE, snappedX);
      const nextBottom = Math.max(zone.y + MIN_ZONE_SIZE, snappedY);
      return {
        x: clampCanvasPosition(nextX),
        y: zone.y,
        width: right - nextX,
        height: nextBottom - zone.y
      };
    }
    case 'se':
      return {
        x: zone.x,
        y: zone.y,
        width: Math.max(MIN_ZONE_SIZE, snappedX - zone.x),
        height: Math.max(MIN_ZONE_SIZE, snappedY - zone.y)
      };
  }
}

function getWallEndpointPosition(wall: Wall, handle: WallEndpointHandle) {
  return handle === 'start'
    ? { x: wall.x1, y: wall.y1 }
    : { x: wall.x2, y: wall.y2 };
}

function moveWallByDelta(
  wall: Wall,
  nextStart: { x: number; y: number }
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;

  return {
    x1: nextStart.x,
    y1: nextStart.y,
    x2: nextStart.x + dx,
    y2: nextStart.y + dy
  };
}

function resizeWallFromEndpoint(
  wall: Wall,
  handle: WallEndpointHandle,
  pointer: { x: number; y: number }
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  const snappedX = Math.round(pointer.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(pointer.y / GRID_SIZE) * GRID_SIZE;
  const isHorizontal = wall.y1 === wall.y2;

  if (handle === 'start') {
    return isHorizontal
      ? { x1: snappedX, y1: wall.y1, x2: wall.x2, y2: wall.y2 }
      : { x1: wall.x1, y1: snappedY, x2: wall.x2, y2: wall.y2 };
  }

  return isHorizontal
    ? { x1: wall.x1, y1: wall.y1, x2: snappedX, y2: wall.y2 }
    : { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: snappedY };
}

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
  const selectedCellId = useSelectedCellId();
  const selection = useEditorSelection();
  const interactionScope = useInteractionScope();
  const highlightedCellIds = useHighlightedCellIds();
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
  const minRackDistance = useMinRackDistance();

  const isViewMode = viewMode === 'view';
  const isStorageMode = viewMode === 'storage';
  const isLayoutMode = viewMode === 'layout';
  // In View and Storage mode the published rack tree must be
  // used as the source for RackCells so that rackId/faceId/sectionId/levelId
  // in the lookup key match the keys in publishedCellsByStructure.
  // publishedCells is always fetched from the published layout version; the
  // active draft always has fresh UUIDs after create_layout_draft(), causing a
  // permanent identity mismatch when the draft layout is used instead.
  // Fall back to the draft tree when no published version exists; interaction
  // rights still come from viewMode, not from the selected data source.
  const placementLayout = isViewMode || isStorageMode
    ? (workspace?.latestPublished ?? workspace?.activeDraft ?? null)
    : null;
  const moveTargetCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.targetCellId : null;
  const moveSourceCellId =
    activeStorageWorkflow?.kind === 'move-container' ? activeStorageWorkflow.sourceCellId : null;
  const isPlacementMoveMode = activeStorageWorkflow?.kind === 'move-container';
  const isPlacing = editorMode === 'place' && isLayoutEditable;
  const isDrawingZone = editorMode === 'draw-zone' && isLayoutEditable;
  const isLayoutDrawToolActive = isPlacing || isDrawingZone;
  const placementFloorId = isViewMode || isStorageMode ? workspace?.floorId ?? null : null;
  const runtimeFloorId = isViewMode ? workspace?.floorId ?? null : null;
  const { data: floorCellOccupancy = [] } = useFloorLocationOccupancy(placementFloorId);
  const { data: floorOperationsCells = [] } = useFloorOperationsCells(runtimeFloorId);
  const { data: publishedCells = [] } = usePublishedCells(
    placementFloorId
  );

  const stageRef = useRef<Konva.Stage | null>(null);

  // ── Marquee (box) selection ──────────────────────────────────────────────
  // marquee drives the Konva Rect visual; marqueeRef is readable in event handlers
  // without stale closure issues.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftZoneRect, setDraftZoneRect] = useState<CanvasRect | null>(null);
  const draftZoneRectRef = useRef<CanvasRect | null>(null);
  const draftZoneStartRef = useRef<{ x: number; y: number } | null>(null);
  // Set to true on the first mousemove past threshold; cleared by click.canvas handler.
  const dragDidHappenRef = useRef(false);

  const [snapGuides, setSnapGuides] = useState<Array<{ type: 'x' | 'y'; position: number }>>([]);

  const racks = useMemo(() => {
    const layout = placementLayout ?? layoutDraft;
    return layout ? layout.rackIds.map((id) => layout.racks[id]) : [];
  }, [placementLayout, layoutDraft]);
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
  const zones = useMemo(
    () => (layoutDraft
      ? layoutDraft.zoneIds
        .map((id) => layoutDraft.zones[id])
        .filter((zone): zone is Zone => Boolean(zone))
      : []),
    [layoutDraft]
  );
  const walls = useMemo(
    () => (layoutDraft
      ? layoutDraft.wallIds
        .map((id) => layoutDraft.walls[id])
        .filter((wall): wall is Wall => Boolean(wall))
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

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const isDrawingZoneRef = useRef(isDrawingZone);
  isDrawingZoneRef.current = isDrawingZone;
  const interactionScopeRef = useRef(interactionScope);
  interactionScopeRef.current = interactionScope;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const createZoneRef = useRef(createZone);
  createZoneRef.current = createZone;
  const setSelectedRackIdsRef = useRef(setSelectedRackIds);
  setSelectedRackIdsRef.current = setSelectedRackIds;
  const setSelectedRackIdRef = useRef(setSelectedRackId);
  setSelectedRackIdRef.current = setSelectedRackId;
  const setSelectedZoneIdRef = useRef(setSelectedZoneId);
  setSelectedZoneIdRef.current = setSelectedZoneId;
  const setSelectedWallIdRef = useRef(setSelectedWallId);
  setSelectedWallIdRef.current = setSelectedWallId;
  const selectedZoneIdRef = useRef(selectedZoneId);
  selectedZoneIdRef.current = selectedZoneId;
  const selectedWallIdRef = useRef(selectedWallId);
  selectedWallIdRef.current = selectedWallId;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const cancelPlacementInteractionRef = useRef(cancelPlacementInteraction);
  cancelPlacementInteractionRef.current = cancelPlacementInteraction;
  const toggleRackSelectionRef = useRef(toggleRackSelection);
  toggleRackSelectionRef.current = toggleRackSelection;
  const selectedRackIdsRef = useRef(selectedRackIds);
  selectedRackIdsRef.current = selectedRackIds;
  const minRackDistanceRef = useRef(minRackDistance);
  minRackDistanceRef.current = minRackDistance;
  const updateRackPositionRef = useRef(updateRackPosition);
  updateRackPositionRef.current = updateRackPosition;
  const updateZoneRectRef = useRef(updateZoneRect);
  updateZoneRectRef.current = updateZoneRect;
  const deleteZoneRef = useRef(deleteZone);
  deleteZoneRef.current = deleteZone;
  const updateWallGeometryRef = useRef(updateWallGeometry);
  updateWallGeometryRef.current = updateWallGeometry;
  const deleteWallRef = useRef(deleteWall);
  deleteWallRef.current = deleteWall;

  useCanvasKeyboardShortcuts({
    isLayoutEditable,
    isPlacingRef,
    isDrawingZoneRef,
    interactionScopeRef,
    cancelPlacementInteractionRef,
    clearSelectionRef,
    selectedRackIdsRef,
    selectedZoneIdRef,
    selectedWallIdRef,
    deleteZoneRef,
    deleteWallRef,
    draftZoneStartRef,
    setEditorMode,
    setDraftZoneRect,
    clearHighlightedCellIds
  });

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handler = () => {
      // A marquee drag just completed — mouseup already applied the selection.
      // Suppress this click so we don't immediately clear it.
      if (dragDidHappenRef.current) {
        dragDidHappenRef.current = false;
        return;
      }

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      if (isPlacingRef.current) {
        createRackRef.current(
          Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          Math.round(pos.y / GRID_SIZE) * GRID_SIZE
        );
      } else if (isDrawingZoneRef.current) {
        return;
      } else {
        if (interactionScopeRef.current === 'workflow') {
          cancelPlacementInteractionRef.current();
          clearHighlightedCellIds();
          return;
        }

        clearSelectionRef.current();
        clearHighlightedCellIds();
      }
    };

    stage.on('click.canvas', handler);
    return () => {
      stage.off('click.canvas');
    };
  }, [viewport]);

  const gridLines = useMemo(() => {
    if (!viewport.width || !viewport.height) {
      return { v: [] as number[], h: [] as number[], startX: 0, endX: 0, startY: 0, endY: 0 };
    }

    const offsetX = canvasOffset.x / zoom;
    const offsetY = canvasOffset.y / zoom;
    const visibleW = viewport.width / zoom;
    const visibleH = viewport.height / zoom;

    const startX = Math.floor(-offsetX / GRID_SIZE) * GRID_SIZE;
    const endX = startX + visibleW + GRID_SIZE * 2;
    const startY = Math.floor(-offsetY / GRID_SIZE) * GRID_SIZE;
    const endY = startY + visibleH + GRID_SIZE * 2;

    const vertical: number[] = [];
    for (let x = startX; x <= endX; x += GRID_SIZE) vertical.push(x);
    const horizontal: number[] = [];
    for (let y = startY; y <= endY; y += GRID_SIZE) horizontal.push(y);

    return { v: vertical, h: horizontal, startX, endX, startY, endY };
  }, [zoom, viewport.width, viewport.height, canvasOffset]);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!layoutDraft || !isLayoutEditable) return;

    const node = event.target;
    let x = clampCanvasPosition(node.x() - node.offsetX());
    let y = clampCanvasPosition(node.y() - node.offsetY());

    const rack = layoutDraft.racks[rackId];
    const otherRacks = Object.values(layoutDraft.racks).filter((item) => item.id !== rackId);
    const snapInfo = getSnapPosition(rack, x, y, otherRacks, minRackDistanceRef.current, 0.5);

    if (snapInfo.snappedToX || snapInfo.snappedToY) {
      x = snapInfo.snappedX;
      y = snapInfo.snappedY;
      setSnapGuides(
        [
          snapInfo.snappedToX && { type: 'x' as const, position: x },
          snapInfo.snappedToY && { type: 'y' as const, position: y }
        ].filter(Boolean) as Array<{ type: 'x' | 'y'; position: number }>
      );
    } else {
      setSnapGuides([]);
    }

    updateRackPositionRef.current(rackId, x, y);
  };

  const handleZoneDragMove = (zone: Zone, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!layoutDraft || !isLayoutEditable) return;

    const node = event.target;
    const x = clampCanvasPosition(
      Math.round(node.x() / GRID_SIZE) * GRID_SIZE
    );
    const y = clampCanvasPosition(
      Math.round(node.y() / GRID_SIZE) * GRID_SIZE
    );

    updateZoneRectRef.current(zone.id, {
      x,
      y,
      width: zone.width,
      height: zone.height
    });
  };

  const handleZoneResizeDragMove = (
    zone: Zone,
    handle: ZoneResizeHandle,
    event: Konva.KonvaEventObject<DragEvent>
  ) => {
    if (!layoutDraft || !isLayoutEditable) return;

    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return;

    event.cancelBubble = true;
    updateZoneRectRef.current(zone.id, resizeZoneFromHandle(zone, handle, pointer));
  };

  const handleWallDragMove = (wall: Wall, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!layoutDraft || !isLayoutEditable) return;

    const node = event.target;
    const x = clampCanvasPosition(
      Math.round(node.x() / GRID_SIZE) * GRID_SIZE
    );
    const y = clampCanvasPosition(
      Math.round(node.y() / GRID_SIZE) * GRID_SIZE
    );

    updateWallGeometryRef.current(wall.id, moveWallByDelta(wall, { x, y }));
  };

  const handleWallEndpointDragMove = (
    wall: Wall,
    handle: WallEndpointHandle,
    event: Konva.KonvaEventObject<DragEvent>
  ) => {
    if (!layoutDraft || !isLayoutEditable) return;

    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return;

    event.cancelBubble = true;
    updateWallGeometryRef.current(wall.id, resizeWallFromEndpoint(wall, handle, pointer));
  };

  const handleCellClick = (cellId: string, anchor: { x: number; y: number }) => {
    void anchor;

    if (isStorageMode) {
      if (activeStorageWorkflow?.kind === 'move-container') {
        setPlacementMoveTargetCellId(cellId);
        return;
      }

      setSelectedCellId(cellId);
      return;
    }

    if (isViewMode) {
      setSelectedCellId(cellId);
      setHighlightedCellIds([cellId]);
    }
  };

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
        background: isPlacing ? '#f0fdfe' : isDrawingZone ? '#f0fdf4' : '#f1f5f9'
      }}
    >
      {!layoutDraft && (
        <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading layout...
        </div>
      )}

      {layoutDraft && (
        <>
          {isPlacing && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-center justify-center">
              <div
                className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
                style={{
                  background: 'rgba(15,24,42,0.88)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(6,182,212,0.4)'
                }}
              >
                Click canvas to place rack · Press{' '}
                <kbd className="mx-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>{' '}
                to cancel
              </div>
            </div>
          )}

          {isDrawingZone && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-center justify-center">
              <div
                className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
                style={{
                  background: 'rgba(15,24,42,0.88)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(34,197,94,0.4)'
                }}
              >
                Drag on empty canvas to draw zone · Press{' '}
                <kbd className="mx-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>{' '}
                to cancel
              </div>
            </div>
          )}

          {isPlacementMoveMode && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex items-center justify-center">
              <div
                className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
                style={{
                  background: 'rgba(15,24,42,0.88)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(14,165,233,0.4)'
                }}
              >
                Move target selection active · Click a destination cell
              </div>
            </div>
          )}

          {shouldShowLayoutRackBar && selectedRack && selectedRackAnchorRect && (
            <LayoutRackAffordanceBar
              displayCode={selectedRack.displayCode}
              anchorRect={selectedRackAnchorRect}
              viewport={viewport}
              onOpenInspector={onOpenInspector}
            />
          )}

          {shouldShowLayoutRackSideHandles && selectedRack && selectedRackAnchorRect && (
            <RackSideFocusHandles
              anchorRect={selectedRackAnchorRect}
              viewport={viewport}
              activeSide={selectedRackSideFocus}
              onSelectSide={(side) => setSelectedRackSide(selectedRack.id, side)}
            />
          )}

          {shouldShowLayoutZoneBar && selectedZone && selectedZoneAnchorRect && (
            <LayoutZoneAffordanceBar
              zone={selectedZone}
              anchorRect={selectedZoneAnchorRect}
              viewport={viewport}
              onOpenInspector={onOpenInspector}
            />
          )}

          {shouldShowLayoutWallBar && selectedWall && selectedWallAnchorRect && (
            <LayoutWallAffordanceBar
              wall={selectedWall}
              anchorRect={selectedWallAnchorRect}
              viewport={viewport}
              onOpenInspector={onOpenInspector}
            />
          )}

          {shouldShowStorageCellBar && selectedStorageCell && selectedStorageCellAnchorRect && (
            <StorageCellAffordanceBar
              cell={selectedStorageCell}
              anchorRect={selectedStorageCellAnchorRect}
              viewport={viewport}
              onOpenInspector={onOpenInspector}
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
                handleZoom(delta);
              }}
              onMouseDown={(event) => {
                // Empty-canvas drags in layout mode are either zone creation or marquee selection.
                // Rack/zone groups suppress this via cancelBubble on their own onMouseDown.
                if (event.evt.button !== 0 || !isLayoutMode || isPlacing) return;
                const pos = stageRef.current?.getRelativePointerPosition();
                if (!pos) return;

                if (isDrawingZone) {
                  const x = Math.round(pos.x / GRID_SIZE) * GRID_SIZE;
                  const y = Math.round(pos.y / GRID_SIZE) * GRID_SIZE;
                  draftZoneStartRef.current = { x, y };
                  const initialRect = {
                    x,
                    y,
                    width: MIN_ZONE_SIZE,
                    height: MIN_ZONE_SIZE
                  };
                  draftZoneRectRef.current = initialRect;
                  setDraftZoneRect(initialRect);
                  dragDidHappenRef.current = false;
                  return;
                }

                marqueeStartRef.current = { x: pos.x, y: pos.y };
                dragDidHappenRef.current = false;
              }}
              onMouseMove={() => {
                if (draftZoneStartRef.current) {
                  const pos = stageRef.current?.getRelativePointerPosition();
                  if (!pos) return;
                  const dx = pos.x - draftZoneStartRef.current.x;
                  const dy = pos.y - draftZoneStartRef.current.y;
                  if (!dragDidHappenRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                    return;
                  }
                  dragDidHappenRef.current = true;
                  const x2 = Math.round(pos.x / GRID_SIZE) * GRID_SIZE;
                  const y2 = Math.round(pos.y / GRID_SIZE) * GRID_SIZE;
                  const nextRect = {
                    x: Math.min(draftZoneStartRef.current.x, x2),
                    y: Math.min(draftZoneStartRef.current.y, y2),
                    width: Math.max(MIN_ZONE_SIZE, Math.abs(x2 - draftZoneStartRef.current.x)),
                    height: Math.max(MIN_ZONE_SIZE, Math.abs(y2 - draftZoneStartRef.current.y))
                  };
                  draftZoneRectRef.current = nextRect;
                  setDraftZoneRect(nextRect);
                  return;
                }

                if (!marqueeStartRef.current) return;
                const pos = stageRef.current?.getRelativePointerPosition();
                if (!pos) return;
                const dx = pos.x - marqueeStartRef.current.x;
                const dy = pos.y - marqueeStartRef.current.y;
                if (!dragDidHappenRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
                dragDidHappenRef.current = true;
                const next = { x1: marqueeStartRef.current.x, y1: marqueeStartRef.current.y, x2: pos.x, y2: pos.y };
                marqueeRef.current = next;
                setMarquee(next);
              }}
              onMouseUp={() => {
                if (draftZoneStartRef.current) {
                  draftZoneStartRef.current = null;
                  const createdRect = draftZoneRectRef.current;
                  draftZoneRectRef.current = null;
                  setDraftZoneRect(null);
                  if (!dragDidHappenRef.current || !createdRect) return;
                  createZoneRef.current(createdRect);
                  return;
                }

                if (!marqueeStartRef.current) return;
                marqueeStartRef.current = null;
                const current = marqueeRef.current;
                marqueeRef.current = null;
                setMarquee(null);
                if (!dragDidHappenRef.current || !current || !layoutDraft) return;
                const nx = Math.min(current.x1, current.x2);
                const ny = Math.min(current.y1, current.y2);
                const nw = Math.abs(current.x2 - current.x1);
                const nh = Math.abs(current.y2 - current.y1);
                if (nw < 4 || nh < 4) return;
                const matched = Object.values(layoutDraft.racks)
                  .filter((rack) => {
                    const g = getRackGeometry(rack);
                    return g.x < nx + nw && g.x + g.width > nx && g.y < ny + nh && g.y + g.height > ny;
                  })
                  .map((rack) => rack.id);
                setSelectedRackIdsRef.current(matched);
              }}
            >
              <Layer listening={false}>
                {gridLines.v.map((x) => (
                  <Line
                    key={`v-${x}`}
                    points={[x, gridLines.startY, x, gridLines.endY]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.55}
                  />
                ))}
                {gridLines.h.map((y) => (
                  <Line
                    key={`h-${y}`}
                    points={[gridLines.startX, y, gridLines.endX, y]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.55}
                  />
                ))}
              </Layer>

              <Layer>
                {zones.map((zone) => {
                  const isSelectedZone = selectedZoneId === zone.id;

                  return (
                    <Group
                      key={zone.id}
                      x={zone.x}
                      y={zone.y}
                      draggable={isLayoutEditable && canSelectZone}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectZone) return;
                        setSelectedZoneIdRef.current(zone.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectZone) return;
                        setSelectedZoneIdRef.current(zone.id);
                      }}
                      onDragStart={() => {
                        if (canSelectZone) {
                          setSelectedZoneIdRef.current(zone.id);
                        }
                      }}
                      onDragMove={(event) => handleZoneDragMove(zone, event)}
                      onDragEnd={(event) => {
                        const currentZone = layoutDraft?.zones[zone.id] ?? zone;
                        event.target.position({
                          x: currentZone.x,
                          y: currentZone.y
                        });
                      }}
                    >
                      <Rect
                        x={0}
                        y={0}
                        width={zone.width}
                        height={zone.height}
                        fill={zone.color}
                        opacity={0.16}
                        stroke={isSelectedZone ? '#0f172a' : zone.color}
                        strokeWidth={isSelectedZone ? 2 : 1}
                        strokeScaleEnabled={false}
                        dash={isSelectedZone ? [6, 4] : undefined}
                        cornerRadius={8}
                      />

                      <Text
                        x={10}
                        y={10}
                        width={Math.max(24, zone.width - 20)}
                        text={`${zone.name} · ${zone.code}`}
                        fontSize={12}
                        fontStyle="bold"
                        fill="#0f172a"
                        ellipsis
                        listening={false}
                      />

                      {isSelectedZone &&
                        isLayoutEditable &&
                        canSelectZone &&
                        (['nw', 'ne', 'sw', 'se'] as ZoneResizeHandle[]).map((handle) => {
                          const point = getZoneResizeHandlePosition(zone, handle);

                          return (
                            <Rect
                              key={`${zone.id}-${handle}`}
                              x={point.x - ZONE_RESIZE_HANDLE_SIZE / 2}
                              y={point.y - ZONE_RESIZE_HANDLE_SIZE / 2}
                              width={ZONE_RESIZE_HANDLE_SIZE}
                              height={ZONE_RESIZE_HANDLE_SIZE}
                              fill="#ffffff"
                              stroke="#0f172a"
                              strokeWidth={1.5}
                              strokeScaleEnabled={false}
                              cornerRadius={2}
                              draggable
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                              }}
                              onClick={(event) => {
                                event.cancelBubble = true;
                              }}
                              onDragMove={(event) =>
                                handleZoneResizeDragMove(zone, handle, event)
                              }
                              onDragEnd={(event) => {
                                const currentZone = layoutDraft?.zones[zone.id] ?? zone;
                                const point = getZoneResizeHandlePosition(currentZone, handle);
                                event.target.position({
                                  x: point.x - ZONE_RESIZE_HANDLE_SIZE / 2,
                                  y: point.y - ZONE_RESIZE_HANDLE_SIZE / 2
                                });
                              }}
                            />
                          );
                        })}
                    </Group>
                  );
                })}

                {draftZoneRect && (
                  <Rect
                    x={draftZoneRect.x}
                    y={draftZoneRect.y}
                    width={draftZoneRect.width}
                    height={draftZoneRect.height}
                    fill="#22c55e"
                    opacity={0.12}
                    stroke="#16a34a"
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    dash={[6, 4]}
                    cornerRadius={8}
                  />
                )}
              </Layer>

              <Layer>
                {walls.map((wall) => {
                  const isSelectedWall = selectedWallId === wall.id;
                  const lineDx = wall.x2 - wall.x1;
                  const lineDy = wall.y2 - wall.y1;

                  return (
                    <Group
                      key={wall.id}
                      x={wall.x1}
                      y={wall.y1}
                      draggable={isLayoutEditable && canSelectWall}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectWall) return;
                        setSelectedWallIdRef.current(wall.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectWall) return;
                        setSelectedWallIdRef.current(wall.id);
                      }}
                      onDragStart={() => {
                        if (canSelectWall) {
                          setSelectedWallIdRef.current(wall.id);
                        }
                      }}
                      onDragMove={(event) => handleWallDragMove(wall, event)}
                      onDragEnd={(event) => {
                        const currentWall = layoutDraft?.walls[wall.id] ?? wall;
                        event.target.position({
                          x: currentWall.x1,
                          y: currentWall.y1
                        });
                      }}
                    >
                      <Line
                        points={[0, 0, lineDx, lineDy]}
                        stroke="transparent"
                        strokeWidth={18}
                        strokeScaleEnabled={false}
                        lineCap="round"
                      />
                      <Line
                        points={[0, 0, lineDx, lineDy]}
                        stroke={isSelectedWall ? '#0f172a' : '#64748b'}
                        strokeWidth={isSelectedWall ? 5 : 4}
                        strokeScaleEnabled={false}
                        lineCap="round"
                        dash={wall.blocksRackPlacement ? undefined : [8, 6]}
                        shadowColor={isSelectedWall ? 'rgba(15,23,42,0.18)' : 'transparent'}
                        shadowBlur={isSelectedWall ? 8 : 0}
                      />

                      {isSelectedWall &&
                        isLayoutEditable &&
                        canSelectWall &&
                        (['start', 'end'] as WallEndpointHandle[]).map((handle) => {
                          const point = getWallEndpointPosition(wall, handle);
                          const localX = point.x - wall.x1;
                          const localY = point.y - wall.y1;

                          return (
                            <Circle
                              key={`${wall.id}-${handle}`}
                              x={localX}
                              y={localY}
                              radius={WALL_HANDLE_RADIUS}
                              fill="#ffffff"
                              stroke="#0f172a"
                              strokeWidth={1.5}
                              strokeScaleEnabled={false}
                              draggable
                              onMouseDown={(event) => {
                                event.cancelBubble = true;
                              }}
                              onClick={(event) => {
                                event.cancelBubble = true;
                                if (!canSelectWall) return;
                                setSelectedWallIdRef.current(wall.id);
                              }}
                              onDragMove={(event) =>
                                handleWallEndpointDragMove(wall, handle, event)
                              }
                              onDragEnd={(event) => {
                                const currentWall = layoutDraft?.walls[wall.id] ?? wall;
                                const point = getWallEndpointPosition(currentWall, handle);
                                event.target.position({
                                  x: point.x - currentWall.x1,
                                  y: point.y - currentWall.y1
                                });
                              }}
                            />
                          );
                        })}
                    </Group>
                  );
                })}
              </Layer>

              <SnapGuides guides={snapGuides} gridLines={gridLines} />

              <Layer>
                {racks.map((rack) => {
                  const geometry = getRackGeometry(rack);
                  const isSelected = selectedRackIds.includes(rack.id);
                  const isHovered = hoveredRackId === rack.id;
                  const isRackPassive =
                    interactionScope !== 'idle' &&
                    !isSelected &&
                    activeCellRackId !== rack.id &&
                    moveSourceRackId !== rack.id;
                  const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
                  const faceB = rack.faces.find((face) => face.side === 'B') ?? null;

                  return (
                    <Group
                      key={rack.id}
                      x={geometry.x + geometry.centerX}
                      y={geometry.y + geometry.centerY}
                      offsetX={geometry.centerX}
                      offsetY={geometry.centerY}
                      rotation={rack.rotationDeg}
                      draggable={isLayoutEditable && !isPlacing}
                      onMouseDown={(event) => {
                        // Prevent Stage onMouseDown from starting a marquee when clicking a rack.
                        event.cancelBubble = true;
                      }}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectRack) return;

                        if (!isLayoutMode) {
                          clearHighlightedCellIds();
                          setSelectedRackIdsRef.current([rack.id]);
                          return;
                        }

                        const pointerEvent = event.evt as unknown as PointerEvent;
                        if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
                          toggleRackSelectionRef.current(rack.id);
                        } else {
                          setSelectedRackIdRef.current(rack.id);
                        }
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        if (!canSelectRack) return;

                        if (!isLayoutMode) {
                          clearHighlightedCellIds();
                          setSelectedRackIdsRef.current([rack.id]);
                          return;
                        }

                        const pointerEvent = event.evt as unknown as PointerEvent;
                        if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
                          toggleRackSelectionRef.current(rack.id);
                        } else {
                          setSelectedRackIdRef.current(rack.id);
                        }
                      }}
                      onMouseEnter={() => {
                        if (canSelectRack) setHoveredRackId(rack.id);
                      }}
                      onMouseLeave={() => {
                        if (canSelectRack) setHoveredRackId(null);
                      }}
                      onDragStart={() => {
                        if (isLayoutEditable && !selectedRackIds.includes(rack.id)) {
                          setSelectedRackIds([rack.id]);
                        }
                      }}
                      onDragMove={(event) => handleDragMove(rack.id, event)}
                      onDragEnd={(e) => {
                        setSnapGuides([]);
                        const node = e.target;
                        if (layoutDraft && layoutDraft.racks[rack.id]) {
                          const geometry = getRackGeometry(layoutDraft.racks[rack.id]);
                          node.position({
                            x: geometry.x + geometry.centerX,
                            y: geometry.y + geometry.centerY
                          });
                        }
                      }}
                    >
                      <Rect x={0} y={0} width={geometry.width} height={geometry.height} fill="transparent" />

                      <RackBody
                        geometry={geometry}
                        displayCode={rack.displayCode}
                        rotationDeg={rack.rotationDeg}
                        isSelected={isSelected}
                        isHovered={isHovered}
                        isPassive={isRackPassive}
                        lod={lod}
                      />

                      {lod >= 1 && faceA && (
                        <RackSections
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                          isPassive={isRackPassive}
                        />
                      )}

                      {(lod >= 2 || (isViewMode && lod >= 1)) && faceA && (
                        <RackCells
                          geometry={geometry}
                          rackId={rack.id}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                          publishedCellsByStructure={publishedCellsByStructure}
                          occupiedCellIds={occupiedCellIds}
                          cellRuntimeById={floorOperationsCellsById}
                          highlightedCellIds={highlightedCellIdSet}
                          isInteractive={canSelectCells}
                          isWorkflowScope={isPlacementMoveMode}
                          isPassive={isRackPassive}
                          selectedCellId={canvasSelectedCellId}
                          workflowSourceCellId={moveSourceCellId}
                          onCellClick={handleCellClick}
                        />
                      )}
                    </Group>
                  );
                })}
              </Layer>

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

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
            {!isLayoutDrawToolActive && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  background: 'rgba(15,24,42,0.72)',
                  color: '#94a3b8',
                  backdropFilter: 'blur(4px)'
                }}
              >
                {isViewMode
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
                    ? 'Drag · Ctrl+click · Drag to select · MMB pan · Scroll zoom · Del'
                    : 'Read-only · MMB pan · Scroll zoom'}
              </div>
            )}

            <div
              className="pointer-events-auto flex items-center gap-1 rounded-xl px-2 py-1.5 shadow-md"
              style={{
                background: 'var(--surface-strong)',
                border: '1px solid var(--border-muted)'
              }}
            >
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <Minus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom(1)}
                className="min-w-[44px] rounded-lg px-2 py-0.5 text-center text-[11px] font-medium transition-colors hover:bg-slate-100"
                style={{ color: 'var(--text-primary)' }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
