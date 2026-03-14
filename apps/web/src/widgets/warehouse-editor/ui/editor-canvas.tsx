import { useEffect, useMemo, useRef, useState } from 'react';
import type { FloorWorkspace } from '@wos/domain';
import { Group, Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import { Copy, Minus, Plus, RotateCcw, RotateCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  useCanvasZoom,
  useCreateRack,
  useDeleteRack,
  useDuplicateRack,
  useEditorMode,
  usePlacementInteraction,
  useHoveredRackId,
  useIsLayoutEditable,
  useRotateRack,
  useSelectedCellId,
  useSetPlacementMoveTargetCellId,
  useSelectedRackId,
  useSelectedRackIds,
  useSetCanvasZoom,
  useSetEditorMode,
  useSetHoveredRackId,
  useSetSelectedCellId,
  useSetSelectedRackId,
  useSetSelectedRackIds,
  useToggleRackSelection,
  useUpdateRackPosition,
  useMinRackDistance,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { indexPublishedCellsByStructure } from '@/entities/cell/lib/published-cell-lookup';
import {
  clampCanvasPosition,
  clampCanvasZoom,
  getCanvasLOD,
  getRackGeometry,
  GRID_SIZE
} from '../lib/canvas-geometry';
import { getSnapPosition } from '../lib/rack-spacing';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { RackSections } from './shapes/rack-sections';
import { SnapGuides } from './shapes/snap-guides';

type FloatingToolbarProps = {
  rackId: string;
  screenX: number;
  screenY: number;
  onOpenInspector: () => void;
};

function FloatingToolbar({ rackId, screenX, screenY, onOpenInspector }: FloatingToolbarProps) {
  const rotateRack = useRotateRack();
  const duplicateRack = useDuplicateRack();
  const deleteRack = useDeleteRack();
  const setSelectedRackId = useSetSelectedRackId();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    deleteRack(rackId);
    setSelectedRackId(null);
    setConfirmDelete(false);
  };

  return (
    <div
      className="pointer-events-auto absolute z-30 flex items-center gap-0.5 rounded-xl px-1.5 py-1 shadow-lg"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translateX(-50%)',
        background: 'var(--surface-strong)',
        border: '1px solid var(--border-muted)',
        boxShadow: 'var(--shadow-panel)'
      }}
    >
      <ToolbarBtn icon={RotateCcw} title="Rotate 90 deg" onClick={() => rotateRack(rackId)} />
      <ToolbarBtn icon={Copy} title="Duplicate" onClick={() => duplicateRack(rackId)} />
      <ToolbarBtn icon={SlidersHorizontal} title="Inspect" onClick={onOpenInspector} accent />

      <div className="mx-0.5 h-4 w-px" style={{ background: 'var(--border-muted)' }} />

      {confirmDelete ? (
        <>
          <span className="px-1 text-[11px] font-medium text-red-600">Delete?</span>
          <ToolbarBtn icon={Trash2} title="Confirm delete" onClick={handleDelete} danger />
          <ToolbarBtn icon={RotateCw} title="Cancel" onClick={() => setConfirmDelete(false)} />
        </>
      ) : (
        <ToolbarBtn icon={Trash2} title="Delete rack" onClick={handleDelete} danger />
      )}
    </div>
  );
}

function ToolbarBtn({
  icon: Icon,
  title,
  onClick,
  accent,
  danger
}: {
  icon: typeof Copy;
  title: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
      style={
        accent
          ? { color: 'var(--accent)' }
          : danger
            ? { color: 'var(--danger)' }
            : { color: 'var(--text-muted)' }
      }
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function EditorCanvas({
  workspace,
  onAddRack,
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
  const selectedCellId = useSelectedCellId();
  const placementInteraction = usePlacementInteraction();
  const hoveredRackId = useHoveredRackId();
  const setSelectedRackIds = useSetSelectedRackIds();
  const setSelectedCellId = useSetSelectedCellId();
  const setPlacementMoveTargetCellId = useSetPlacementMoveTargetCellId();
  const toggleRackSelection = useToggleRackSelection();
  const setHoveredRackId = useSetHoveredRackId();
  const setCanvasZoom = useSetCanvasZoom();
  const setEditorMode = useSetEditorMode();
  const updateRackPosition = useUpdateRackPosition();
  const createRack = useCreateRack();
  const minRackDistance = useMinRackDistance();

  const isPlacementMode = viewMode === 'placement';
  const moveTargetCellId =
    placementInteraction.type === 'move-container' ? placementInteraction.targetCellId : null;
  const isPlacementMoveMode = placementInteraction.type === 'move-container';
  const isPlacing = editorMode === 'place' && isLayoutEditable;
  const { data: publishedCells = [] } = usePublishedCells(
    isPlacementMode ? workspace?.floorId ?? null : null
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasOffsetRef = useRef({ x: 0, y: 0 });
  canvasOffsetRef.current = canvasOffset;

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const offsetAtPanStartRef = useRef({ x: 0, y: 0 });

  const [snapGuides, setSnapGuides] = useState<Array<{ type: 'x' | 'y'; position: number }>>([]);

  const racks = useMemo(
    () => (layoutDraft ? layoutDraft.rackIds.map((id) => layoutDraft.racks[id]) : []),
    [layoutDraft]
  );
  const publishedCellsByStructure = useMemo(
    () => indexPublishedCellsByStructure(publishedCells),
    [publishedCells]
  );
  const lod = getCanvasLOD(zoom);

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const setSelectedRackIdsRef = useRef(setSelectedRackIds);
  setSelectedRackIdsRef.current = setSelectedRackIds;
  const toggleRackSelectionRef = useRef(toggleRackSelection);
  toggleRackSelectionRef.current = toggleRackSelection;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setCanvasZoomRef = useRef(setCanvasZoom);
  setCanvasZoomRef.current = setCanvasZoom;
  const selectedRackIdsRef = useRef(selectedRackIds);
  selectedRackIdsRef.current = selectedRackIds;
  const minRackDistanceRef = useRef(minRackDistance);
  minRackDistanceRef.current = minRackDistance;
  const updateRackPositionRef = useRef(updateRackPosition);
  updateRackPositionRef.current = updateRackPosition;

  const selectedRack =
    selectedRackId && !isPlacing && layoutDraft ? layoutDraft.racks[selectedRackId] : null;
  const selectedRackGeometry = selectedRack ? getRackGeometry(selectedRack) : null;

  const toolbarScreenX = selectedRackGeometry
    ? (selectedRackGeometry.x + selectedRackGeometry.width / 2) * zoom + canvasOffset.x
    : 0;
  const toolbarScreenY = selectedRackGeometry
    ? selectedRackGeometry.y * zoom + canvasOffset.y - 44
    : 0;
  const clampedToolbarY = Math.max(8, toolbarScreenY);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      isPanningRef.current = true;
      panStartRef.current = { x: event.clientX, y: event.clientY };
      offsetAtPanStartRef.current = { ...canvasOffsetRef.current };
      setIsPanning(true);
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      setCanvasOffset({
        x: offsetAtPanStartRef.current.x + dx,
        y: offsetAtPanStartRef.current.y + dy
      });
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) return;
      isPanningRef.current = false;
      setIsPanning(false);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handler = () => {
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      if (isPlacingRef.current) {
        createRackRef.current(
          Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          Math.round(pos.y / GRID_SIZE) * GRID_SIZE
        );
      } else {
        setSelectedRackIdsRef.current([]);
      }
    };

    stage.on('click.canvas', handler);
    return () => {
      stage.off('click.canvas');
    };
  }, [viewport]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isPlacingRef.current) {
        setEditorMode('select');
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isPlacingRef.current && isLayoutEditable) {
        const rackId = selectedRackIdsRef.current[0];
        const target = event.target as HTMLElement;
        const isEditing =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT';
        if (rackId && !isEditing) {
          window.dispatchEvent(new CustomEvent('rack:request-delete', { detail: { rackId } }));
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLayoutEditable, setEditorMode]);

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

  const handlePlacementCellClick = (cellId: string) => {
    if (placementInteraction.type === 'move-container') {
      setPlacementMoveTargetCellId(cellId);
      return;
    }

    setSelectedCellId(cellId);
  };

  const handleZoom = (delta: number) => setCanvasZoom(clampCanvasZoom(Number((zoom + delta).toFixed(2))));

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden"
      style={{
        cursor: isPanning ? 'grabbing' : isPlacing ? 'crosshair' : 'default',
        background: isPlacing ? '#f0fdfe' : '#f1f5f9'
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

          {isLayoutEditable && selectedRack && selectedRackGeometry && (
            <FloatingToolbar
              rackId={selectedRack.id}
              screenX={toolbarScreenX}
              screenY={clampedToolbarY}
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
                setCanvasZoomRef.current(clampCanvasZoom(Number((zoomRef.current + delta).toFixed(2))));
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

              <SnapGuides guides={snapGuides} gridLines={gridLines} />

              <Layer>
                {racks.map((rack) => {
                  const geometry = getRackGeometry(rack);
                  const isSelected = selectedRackIds.includes(rack.id);
                  const isHovered = hoveredRackId === rack.id;
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
                      onClick={(event) => {
                        event.cancelBubble = true;
                        if (isPlacing) return;

                        const pointerEvent = event.evt as unknown as PointerEvent;
                        if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
                          toggleRackSelectionRef.current(rack.id);
                        } else {
                          setSelectedRackIdsRef.current([rack.id]);
                        }
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        if (isPlacing) return;

                        const pointerEvent = event.evt as unknown as PointerEvent;
                        if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
                          toggleRackSelectionRef.current(rack.id);
                        } else {
                          setSelectedRackIdsRef.current([rack.id]);
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isPlacing) setHoveredRackId(rack.id);
                      }}
                      onMouseLeave={() => {
                        if (!isPlacing) setHoveredRackId(null);
                      }}
                      onDragStart={() => {
                        if (isLayoutEditable && !selectedRackIds.includes(rack.id)) {
                          setSelectedRackIds([rack.id]);
                        }
                      }}
                      onDragMove={(event) => handleDragMove(rack.id, event)}
                      onDragEnd={() => setSnapGuides([])}
                    >
                      <Rect x={0} y={0} width={geometry.width} height={geometry.height} fill="transparent" />

                      <RackBody
                        geometry={geometry}
                        displayCode={rack.displayCode}
                        rotationDeg={rack.rotationDeg}
                        isSelected={isSelected}
                        isHovered={isHovered}
                        lod={lod}
                      />

                      {lod >= 1 && faceA && (
                        <RackSections
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                        />
                      )}

                      {lod >= 2 && faceA && (
                        <RackCells
                          geometry={geometry}
                          rackId={rack.id}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                          publishedCellsByStructure={publishedCellsByStructure}
                          isInteractive={isPlacementMode}
                          selectedCellId={isPlacementMode ? moveTargetCellId ?? selectedCellId : null}
                          onCellClick={handlePlacementCellClick}
                        />
                      )}
                    </Group>
                  );
                })}
              </Layer>
            </Stage>
          )}

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
            {!isPlacing && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  background: 'rgba(15,24,42,0.72)',
                  color: '#94a3b8',
                  backdropFilter: 'blur(4px)'
                }}
              >
                {isLayoutEditable ? 'Drag · MMB pan · Scroll zoom · Del delete' : 'Read-only · MMB pan · Scroll zoom'}
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
