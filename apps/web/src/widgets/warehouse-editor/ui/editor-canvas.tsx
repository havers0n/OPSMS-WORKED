import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import { PlusCircle } from 'lucide-react';
import {
  useCanvasZoom,
  useCreateRack,
  useDeleteRack,
  useEditorMode,
  useHoveredRackId,
  useLayoutDraftState,
  useSelectedRackIds,
  useSetCanvasZoom,
  useSetEditorMode,
  useSetHoveredRackId,
  useSetSelectedRackIds,
  useToggleRackSelection,
  useUpdateRackPosition,
  useMinRackDistance
} from '@/entities/layout-version/model/editor-selectors';
import {
  clampCanvasPosition,
  clampCanvasZoom,
  getCanvasLOD,
  getRackGeometry,
  GRID_SIZE
} from '../lib/canvas-geometry';
import { getSnapPosition } from '../lib/rack-spacing';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { RackSections } from './shapes/rack-sections';
import { SnapGuides } from './shapes/snap-guides';

export function EditorCanvas({ onAddRack }: { onAddRack: () => void }) {
  const zoom = useCanvasZoom();
  const editorMode = useEditorMode();
  const layoutDraft = useLayoutDraftState();
  const selectedRackIds = useSelectedRackIds();
  const hoveredRackId = useHoveredRackId();
  const setSelectedRackIds = useSetSelectedRackIds();
  const toggleRackSelection = useToggleRackSelection();
  const setHoveredRackId = useSetHoveredRackId();
  const setCanvasZoom = useSetCanvasZoom();
  const setEditorMode = useSetEditorMode();
  const updateRackPosition = useUpdateRackPosition();
  const createRack = useCreateRack();
  const deleteRack = useDeleteRack();
  const minRackDistance = useMinRackDistance();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // ── Canvas pan (right-click drag) ──────────────────────────────────────────
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasOffsetRef = useRef({ x: 0, y: 0 });
  canvasOffsetRef.current = canvasOffset;

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const offsetAtPanStartRef = useRef({ x: 0, y: 0 });

  // ── Snap guides visualization ─────────────────────────────────────────────
  const [snapGuides, setSnapGuides] = useState<Array<{ type: 'x' | 'y'; position: number }>>([]);

  const racks = useMemo(
    () => (layoutDraft ? layoutDraft.rackIds.map((id) => layoutDraft.racks[id]) : []),
    [layoutDraft]
  );
  const isPlacing = editorMode === 'place';
  const lod = getCanvasLOD(zoom);

  // Keep refs up to date to avoid stale closures in event handlers
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
  const deleteRackRef = useRef(deleteRack);
  deleteRackRef.current = deleteRack;
  const minRackDistanceRef = useRef(minRackDistance);
  minRackDistanceRef.current = minRackDistance;
  const updateRackPositionRef = useRef(updateRackPosition);
  updateRackPositionRef.current = updateRackPosition;

  // Resize observer
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Right-click pan handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // middle mouse button only
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      offsetAtPanStartRef.current = { ...canvasOffsetRef.current };
      setIsPanning(true);
      e.preventDefault(); // prevent native auto-scroll mode
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setCanvasOffset({
        x: offsetAtPanStartRef.current.x + dx,
        y: offsetAtPanStartRef.current.y + dy
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return;
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
  }, []); // stable refs — no deps needed

  // Canvas click handler
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = () => {
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      if (isPlacingRef.current) {
        createRackRef.current(Math.round(pos.x / GRID_SIZE) * GRID_SIZE, Math.round(pos.y / GRID_SIZE) * GRID_SIZE);
      } else {
        setSelectedRackIdsRef.current([]);
      }
    };
    stage.on('click.canvas', handler);
    return () => {
      stage.off('click.canvas');
    };
  }, [viewport]);

  // Keyboard handlers: Escape cancels placement, Delete removes selected rack
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlacingRef.current) {
        setEditorMode('select');
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isPlacingRef.current) {
        const rackId = selectedRackIdsRef.current[0];
        // Only trigger keyboard delete when focus is not inside a text input/textarea/select
        const target = e.target as HTMLElement;
        const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        if (rackId && !isEditing) {
          // We dispatch a custom event to the inspector to trigger the confirm dialog
          // so we don't delete without user confirmation even on keyboard
          window.dispatchEvent(new CustomEvent('rack:request-delete', { detail: { rackId } }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setEditorMode]);

  // Grid lines: generate in world space to fill the visible area, accounting for pan offset
  const gridLines = useMemo(() => {
    if (!viewport.width || !viewport.height) return { v: [] as number[], h: [] as number[], startX: 0, endX: 0, startY: 0, endY: 0 };

    // Visible area in world coordinates
    const offsetX = canvasOffset.x / zoom;
    const offsetY = canvasOffset.y / zoom;
    const visibleW = viewport.width / zoom;
    const visibleH = viewport.height / zoom;

    const startX = Math.floor(-offsetX / GRID_SIZE) * GRID_SIZE;
    const endX   = startX + visibleW + GRID_SIZE * 2;
    const startY = Math.floor(-offsetY / GRID_SIZE) * GRID_SIZE;
    const endY   = startY + visibleH + GRID_SIZE * 2;

    const vertical: number[] = [];
    for (let x = startX; x <= endX; x += GRID_SIZE) vertical.push(x);
    const horizontal: number[] = [];
    for (let y = startY; y <= endY; y += GRID_SIZE) horizontal.push(y);

    return { v: vertical, h: horizontal, startX, endX, startY, endY };
  }, [zoom, viewport.width, viewport.height, canvasOffset]);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!layoutDraft) return;

    const node = event.target;
    let x = clampCanvasPosition(node.x() - node.offsetX());
    let y = clampCanvasPosition(node.y() - node.offsetY());

    // Get snap information from nearby racks
    const rack = layoutDraft.racks[rackId];
    const otherRacks = Object.values(layoutDraft.racks).filter(r => r.id !== rackId);
    const snapInfo = getSnapPosition(rack, x, y, otherRacks, minRackDistanceRef.current, 0.5);

    // Apply snapping if active
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

  const handleZoom = (delta: number) => setCanvasZoom(clampCanvasZoom(Number((zoom + delta).toFixed(2))));

  return (
    <div
      ref={containerRef}
      className={[
        'relative h-full overflow-hidden',
        isPanning ? 'cursor-grabbing' : isPlacing ? 'cursor-crosshair bg-cyan-50' : 'bg-slate-100'
      ].join(' ')}
    >
      {!layoutDraft && (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading layout…</div>
      )}

      {layoutDraft && (
        <>
          {/* Placement mode banner */}
          {isPlacing && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-center">
              <div className="rounded-2xl border border-cyan-400 bg-cyan-950/90 px-5 py-3 text-sm font-medium text-cyan-100 shadow-lg backdrop-blur">
                Click anywhere on the canvas to place a new rack · Press{' '}
                <kbd className="mx-1 rounded-md bg-cyan-800 px-2 py-0.5 font-mono text-xs">Esc</kbd> to cancel
              </div>
            </div>
          )}

          {/* Top-left controls */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-3">
            {!isPlacing && (
              <>
                {/* Viewport / zoom controls */}
                <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Viewport</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoom(-0.1)}
                      className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      −
                    </button>
                    <div className="min-w-[72px] rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-center text-sm font-medium text-slate-700">
                      {Math.round(zoom * 100)}%
                    </div>
                    <button
                      type="button"
                      onClick={() => handleZoom(0.1)}
                      className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanvasZoom(1)}
                      className="rounded-xl border border-[var(--border-muted)] px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Add Rack button */}
                <button
                  type="button"
                  onClick={onAddRack}
                  className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[var(--border-muted)] bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-slate-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Rack
                </button>
              </>
            )}
          </div>

          {/* Bottom-right hint */}
          {!isPlacing && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-[var(--border-muted)] bg-slate-950/90 px-4 py-3 text-xs text-slate-200 shadow-[var(--shadow-soft)]">
              Drag racks · MMB to pan · Scroll to zoom · Del to delete
            </div>
          )}

          {/* Konva Stage */}
          {viewport.width > 0 && viewport.height > 0 && (
            <Stage
              ref={stageRef}
              width={viewport.width}
              height={viewport.height}
              x={canvasOffset.x}
              y={canvasOffset.y}
              scale={{ x: zoom, y: zoom }}
              onWheel={(e) => {
                e.evt.preventDefault();
                const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
                setCanvasZoomRef.current(clampCanvasZoom(Number((zoomRef.current + delta).toFixed(2))));
              }}
            >
              {/* Grid layer (not interactive) */}
              <Layer listening={false}>
                {gridLines.v.map((x) => (
                  <Line
                    key={`v-${x}`}
                    points={[x, gridLines.startY, x, gridLines.endY]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.6}
                  />
                ))}
                {gridLines.h.map((y) => (
                  <Line
                    key={`h-${y}`}
                    points={[gridLines.startX, y, gridLines.endX, y]}
                    stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={0.6}
                  />
                ))}
              </Layer>

              {/* Snap guides layer (not interactive) */}
              <SnapGuides guides={snapGuides} gridLines={gridLines} />

              {/* Rack layer */}
              <Layer>
                {racks.map((rack) => {
                  const geometry = getRackGeometry(rack);
                  const isSelected = selectedRackIds.includes(rack.id);
                  const isHovered = hoveredRackId === rack.id;
                  const faceA = rack.faces.find((f) => f.side === 'A') ?? null;
                  const faceB = rack.faces.find((f) => f.side === 'B') ?? null;

                  return (
                    <Group
                      key={rack.id}
                      x={geometry.x + geometry.centerX}
                      y={geometry.y + geometry.centerY}
                      offsetX={geometry.centerX}
                      offsetY={geometry.centerY}
                      rotation={rack.rotationDeg}
                      draggable={!isPlacing}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (!isPlacing) {
                          const evt = e.evt as unknown as PointerEvent;
                          if (evt.ctrlKey || evt.metaKey) {
                            toggleRackSelectionRef.current(rack.id);
                          } else {
                            setSelectedRackIdsRef.current([rack.id]);
                          }
                        }
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        if (!isPlacing) {
                          const evt = e.evt as unknown as PointerEvent;
                          if (evt.ctrlKey || evt.metaKey) {
                            toggleRackSelectionRef.current(rack.id);
                          } else {
                            setSelectedRackIdsRef.current([rack.id]);
                          }
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isPlacing) setHoveredRackId(rack.id);
                      }}
                      onMouseLeave={() => {
                        if (!isPlacing) setHoveredRackId(null);
                      }}
                      onDragStart={() => {
                        if (!selectedRackIds.includes(rack.id)) {
                          setSelectedRackIds([rack.id]);
                        }
                      }}
                      onDragMove={(e) => handleDragMove(rack.id, e)}
                      onDragEnd={() => setSnapGuides([])}
                    >
                      {/* Transparent hit target covers the full bounding box */}
                      <Rect x={0} y={0} width={geometry.width} height={geometry.height} fill="transparent" />

                      {/* RackBody always renders — even before faces are configured —
                          so the code label (e.g. "01-A") is always visible on canvas */}
                      <RackBody
                        geometry={geometry}
                        displayCode={rack.displayCode}
                        isSelected={isSelected}
                        isHovered={isHovered}
                      />

                      {/* LOD 1: section dividers — only when Face A is configured */}
                      {lod >= 1 && faceA && (
                        <RackSections
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                        />
                      )}

                      {/* LOD 2: slot columns (top-down view) — only when Face A is configured */}
                      {lod >= 2 && faceA && (
                        <RackCells
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                        />
                      )}
                    </Group>
                  );
                })}
              </Layer>
            </Stage>
          )}
        </>
      )}
    </div>
  );
}
