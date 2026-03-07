import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import {
  useCanvasZoom,
  useCreateRack,
  useEditorMode,
  useHoveredRackId,
  useLayoutDraftState,
  useRotateRack,
  useSelectedRackId,
  useSetEditorMode,
  useSetHoveredRackId,
  useSetCanvasZoom,
  useSetSelectedRackId,
  useUpdateRackPosition
} from '@/widgets/warehouse-editor/model/editor-selectors';
import {
  clampCanvasPosition,
  clampCanvasZoom,
  getCanvasLOD,
  getRackGeometry,
  GRID_SIZE,
  ROTATE_HANDLE_SIZE
} from '../lib/canvas-geometry';
import { RackBody }     from './shapes/rack-body';
import { RackSections } from './shapes/rack-sections';
import { RackCells }    from './shapes/rack-cells';

export function EditorCanvas() {
  const zoom = useCanvasZoom();
  const editorMode = useEditorMode();
  const layoutDraft = useLayoutDraftState();
  const selectedRackId = useSelectedRackId();
  const hoveredRackId = useHoveredRackId();
  const setSelectedRackId = useSetSelectedRackId();
  const setHoveredRackId = useSetHoveredRackId();
  const setCanvasZoom = useSetCanvasZoom();
  const setEditorMode = useSetEditorMode();
  const updateRackPosition = useUpdateRackPosition();
  const rotateRack = useRotateRack();
  const createRack = useCreateRack();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const gridStep = GRID_SIZE * zoom;
  const racks = useMemo(
    () => (layoutDraft ? layoutDraft.rackIds.map((id) => layoutDraft.racks[id]) : []),
    [layoutDraft]
  );
  const isPlacing = editorMode === 'place';
  const lod = getCanvasLOD(zoom);

  // Mutable refs so the stage click handler never has stale closures
  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const setSelectedRackIdRef = useRef(setSelectedRackId);
  setSelectedRackIdRef.current = setSelectedRackId;

  // IMPORTANT: containerRef div must ALWAYS be mounted (no early returns before it).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateSize = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Register Konva stage click directly
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;
      if (isPlacingRef.current) {
        createRackRef.current(
          Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          Math.round(pos.y / GRID_SIZE) * GRID_SIZE
        );
      } else {
        setSelectedRackIdRef.current(null);
      }
    };
    stage.on('click.canvas', handler);
    return () => { stage.off('click.canvas'); };
  }, [viewport]);

  useEffect(() => {
    if (!isPlacing) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditorMode('select'); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlacing, setEditorMode]);

  const gridLines = useMemo(() => {
    if (!viewport.width || !viewport.height) return { vertical: [], horizontal: [] };
    const vertical: number[] = [];
    for (let x = 0; x <= viewport.width; x += gridStep) vertical.push(x);
    const horizontal: number[] = [];
    for (let y = 0; y <= viewport.height; y += gridStep) horizontal.push(y);
    return { vertical, horizontal };
  }, [gridStep, viewport.height, viewport.width]);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    updateRackPosition(rackId, clampCanvasPosition(node.x()), clampCanvasPosition(node.y()));
  };

  const selectedRack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;

  const handleZoom = (delta: number) => {
    setCanvasZoom(clampCanvasZoom(Number((zoom + delta).toFixed(2))));
  };

  return (
    <div
      ref={containerRef}
      className={[
        'relative h-full overflow-hidden',
        isPlacing ? 'cursor-crosshair bg-cyan-50' : 'bg-slate-100'
      ].join(' ')}
    >
      {/* Loading state — inside containerRef so ResizeObserver always attaches */}
      {!layoutDraft && (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Loading layout draft…
        </div>
      )}

      {layoutDraft && (
        <>
          {/* ── Place-mode banner ──────────────────────────────────── */}
          {isPlacing && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-center">
              <div className="rounded-2xl border border-cyan-400 bg-cyan-950/90 px-5 py-3 text-sm font-medium text-cyan-100 shadow-lg backdrop-blur">
                Click anywhere on the canvas to place a new rack · Press{' '}
                <kbd className="mx-1 rounded-md bg-cyan-800 px-2 py-0.5 font-mono text-xs">Esc</kbd>{' '}
                to cancel
              </div>
            </div>
          )}

          {/* ── Overlay panels (Viewport zoom + Spatial context) ───── */}
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-3">
            {!isPlacing && (
              <>
                {/* Zoom controls */}
                <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    Viewport
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoom(-0.1)}
                      className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      -
                    </button>
                    <div className="min-w-[82px] rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-center text-sm font-medium text-slate-700">
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
                    <div className="ml-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                      LOD {lod}
                    </div>
                  </div>
                </div>

                {/* Spatial context */}
                <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Spatial Context
                  </div>
                  {selectedRack ? (
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-slate-900">
                        Rack {selectedRack.displayCode}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {selectedRack.kind} · {selectedRack.axis} axis ·{' '}
                        {selectedRack.totalLength.toFixed(1)} m × {selectedRack.depth.toFixed(1)} m
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Position {Math.round(selectedRack.x)}, {Math.round(selectedRack.y)} ·
                        Rotation {selectedRack.rotationDeg}°
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">
                      Select a rack to see its spatial context.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Hint bar (bottom right) ────────────────────────────── */}
          {!isPlacing && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-[var(--border-muted)] bg-slate-950/90 px-4 py-3 text-xs text-slate-200 shadow-[var(--shadow-soft)]">
              Drag to move · Use 90° handle to rotate · Zoom in to see cells
            </div>
          )}

          {/* ── Konva Stage ──────────────────────────────────────────── */}
          {viewport.width > 0 && viewport.height > 0 ? (
            <Stage
              ref={stageRef}
              width={viewport.width}
              height={viewport.height}
              className="h-full w-full"
            >
              {/* Grid layer — non-interactive */}
              <Layer listening={false}>
                {gridLines.vertical.map((x) => (
                  <Rect
                    key={`v-${x}`}
                    x={x} y={0}
                    width={1} height={viewport.height}
                    fill={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    opacity={0.55}
                  />
                ))}
                {gridLines.horizontal.map((y) => (
                  <Rect
                    key={`h-${y}`}
                    x={0} y={y}
                    width={viewport.width} height={1}
                    fill={isPlacing ? '#a5f3fc' : '#cbd5e1'}
                    opacity={0.55}
                  />
                ))}
              </Layer>

              {/* Rack layer */}
              <Layer>
                {racks.map((rack) => {
                  const geometry = getRackGeometry(rack);
                  const isSelected = selectedRackId === rack.id;
                  const isHovered  = hoveredRackId  === rack.id;
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
                      onClick={(event) => {
                        event.cancelBubble = true;
                        if (isPlacing) return;
                        setSelectedRackId(rack.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        if (isPlacing) return;
                        setSelectedRackId(rack.id);
                      }}
                      onMouseEnter={() => { if (!isPlacing) setHoveredRackId(rack.id); }}
                      onMouseLeave={() => { if (!isPlacing) setHoveredRackId(null); }}
                      onDragStart={() => setSelectedRackId(rack.id)}
                      onDragMove={(event) => handleDragMove(rack.id, event)}
                      onDragEnd={(event) => handleDragMove(rack.id, event)}
                    >
                      {/* LOD 0 – all zoom levels: body always rendered */}
                      {faceA && (
                        <RackBody
                          geometry={geometry}
                          displayCode={rack.displayCode}
                          isSelected={isSelected}
                          isHovered={isHovered}
                        />
                      )}

                      {/* LOD 1 – section dividers */}
                      {lod >= 1 && faceA && (
                        <RackSections
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                        />
                      )}

                      {/* LOD 2 – cell grid */}
                      {lod >= 2 && faceA && (
                        <RackCells
                          geometry={geometry}
                          faceA={faceA}
                          faceB={geometry.isPaired ? faceB : null}
                          isSelected={isSelected}
                        />
                      )}

                      {/* Rotate handle — outside LOD (always visible unless placing) */}
                      {!isPlacing && (
                        <Group
                          x={geometry.rotateHandleX}
                          y={geometry.rotateHandleY}
                          onClick={(event) => {
                            event.cancelBubble = true;
                            rotateRack(rack.id);
                            setSelectedRackId(rack.id);
                          }}
                          onTap={(event) => {
                            event.cancelBubble = true;
                            rotateRack(rack.id);
                            setSelectedRackId(rack.id);
                          }}
                        >
                          <Rect
                            width={ROTATE_HANDLE_SIZE}
                            height={ROTATE_HANDLE_SIZE}
                            cornerRadius={8}
                            fill="#ffffff"
                            stroke={isSelected ? '#0f6a8e' : '#cbd5e1'}
                            shadowColor="#0f172a"
                            shadowBlur={6}
                            shadowOpacity={0.1}
                          />
                          <Text
                            x={5} y={7}
                            width={ROTATE_HANDLE_SIZE - 10}
                            text="90°"
                            align="center"
                            fontSize={10}
                            fontStyle="bold"
                            fill="#475569"
                          />
                        </Group>
                      )}
                    </Group>
                  );
                })}
              </Layer>
            </Stage>
          ) : null}
        </>
      )}
    </div>
  );
}
