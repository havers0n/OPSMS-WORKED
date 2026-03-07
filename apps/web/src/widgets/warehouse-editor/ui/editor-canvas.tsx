import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import {
  useCanvasZoom,
  useCreateRack,
  useEditorMode,
  useHoveredRackId,
  useLayoutDraftState,
  useRotateRack,
  useSelectedRackId,
  useSetCanvasZoom,
  useSetEditorMode,
  useSetHoveredRackId,
  useSetSelectedRackId,
  useUpdateRackPosition
} from '@/entities/layout-version/model/editor-selectors';
import {
  clampCanvasPosition,
  clampCanvasZoom,
  getCanvasLOD,
  getRackGeometry,
  GRID_SIZE,
  ROTATE_HANDLE_SIZE
} from '../lib/canvas-geometry';
import { RackBody } from './shapes/rack-body';
import { RackCells } from './shapes/rack-cells';
import { RackSections } from './shapes/rack-sections';

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

  const racks = useMemo(
    () => (layoutDraft ? layoutDraft.rackIds.map((id) => layoutDraft.racks[id]) : []),
    [layoutDraft]
  );
  const isPlacing = editorMode === 'place';
  const lod = getCanvasLOD(zoom);

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const setSelectedRackIdRef = useRef(setSelectedRackId);
  setSelectedRackIdRef.current = setSelectedRackId;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setCanvasZoomRef = useRef(setCanvasZoom);
  setCanvasZoomRef.current = setCanvasZoom;

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
    const stage = stageRef.current;
    if (!stage) return;
    const handler = () => {
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      if (isPlacingRef.current) {
        createRackRef.current(Math.round(pos.x / GRID_SIZE) * GRID_SIZE, Math.round(pos.y / GRID_SIZE) * GRID_SIZE);
      } else {
        setSelectedRackIdRef.current(null);
      }
    };
    stage.on('click.canvas', handler);
    return () => {
      stage.off('click.canvas');
    };
  }, [viewport]);

  useEffect(() => {
    if (!isPlacing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorMode('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlacing, setEditorMode]);

  const gridLines = useMemo(() => {
    if (!viewport.width || !viewport.height) return { v: [] as number[], h: [] as number[] };
    const canvasWidth = viewport.width / zoom;
    const canvasHeight = viewport.height / zoom;
    const vertical: number[] = [];
    for (let x = 0; x <= canvasWidth + GRID_SIZE; x += GRID_SIZE) vertical.push(x);
    const horizontal: number[] = [];
    for (let y = 0; y <= canvasHeight + GRID_SIZE; y += GRID_SIZE) horizontal.push(y);
    return { v: vertical, h: horizontal };
  }, [zoom, viewport.width, viewport.height]);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const x = clampCanvasPosition(node.x() - node.offsetX());
    const y = clampCanvasPosition(node.y() - node.offsetY());
    updateRackPosition(rackId, x, y);
  };

  const selectedRack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;

  const handleZoom = (delta: number) => setCanvasZoom(clampCanvasZoom(Number((zoom + delta).toFixed(2))));

  const canvasWidth = viewport.width / zoom;
  const canvasHeight = viewport.height / zoom;

  return (
    <div
      ref={containerRef}
      className={[
        'relative h-full overflow-hidden',
        isPlacing ? 'cursor-crosshair bg-cyan-50' : 'bg-slate-100'
      ].join(' ')}
    >
      {!layoutDraft && <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading layout draftвЂ¦</div>}

      {layoutDraft && (
        <>
          {isPlacing && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-center justify-center">
              <div className="rounded-2xl border border-cyan-400 bg-cyan-950/90 px-5 py-3 text-sm font-medium text-cyan-100 shadow-lg backdrop-blur">
                Click anywhere on the canvas to place a new rack В· Press <kbd className="mx-1 rounded-md bg-cyan-800 px-2 py-0.5 font-mono text-xs">Esc</kbd> to cancel
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-3">
            {!isPlacing && (
              <>
                <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Viewport</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => handleZoom(-0.1)} className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                      в€’
                    </button>
                    <div className="min-w-[82px] rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-center text-sm font-medium text-slate-700">
                      {Math.round(zoom * 100)}%
                    </div>
                    <button type="button" onClick={() => handleZoom(0.1)} className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                      +
                    </button>
                    <button type="button" onClick={() => setCanvasZoom(1)} className="rounded-xl border border-[var(--border-muted)] px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                      Reset
                    </button>
                    <div className="ml-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">LOD {lod}</div>
                  </div>
                </div>

                <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Spatial Context</div>
                  {selectedRack ? (
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-slate-900">Rack {selectedRack.displayCode}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {selectedRack.kind} В· {selectedRack.axis} axis В· {selectedRack.totalLength.toFixed(1)} m Г— {selectedRack.depth.toFixed(1)} m
                      </div>
                      <div className="mt-2 text-xs text-slate-500">x={Math.round(selectedRack.x)}, y={Math.round(selectedRack.y)} В· {selectedRack.rotationDeg}В°</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">Select a rack to inspect it.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {!isPlacing && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-[var(--border-muted)] bg-slate-950/90 px-4 py-3 text-xs text-slate-200 shadow-[var(--shadow-soft)]">
              Drag to move В· Click 90В° to rotate В· Scroll wheel or +/в€’ to zoom
            </div>
          )}

          {viewport.width > 0 && viewport.height > 0 && (
            <Stage
              ref={stageRef}
              width={viewport.width}
              height={viewport.height}
              scale={{ x: zoom, y: zoom }}
              onWheel={(e) => {
                e.evt.preventDefault();
                const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
                setCanvasZoomRef.current(clampCanvasZoom(Number((zoomRef.current + delta).toFixed(2))));
              }}
            >
              <Layer listening={false}>
                {gridLines.v.map((x) => (
                  <Line key={`v-${x}`} points={[x, 0, x, canvasHeight]} stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'} strokeWidth={1} strokeScaleEnabled={false} opacity={0.6} />
                ))}
                {gridLines.h.map((y) => (
                  <Line key={`h-${y}`} points={[0, y, canvasWidth, y]} stroke={isPlacing ? '#a5f3fc' : '#cbd5e1'} strokeWidth={1} strokeScaleEnabled={false} opacity={0.6} />
                ))}
              </Layer>

              <Layer>
                {racks.map((rack) => {
                  const geometry = getRackGeometry(rack);
                  const isSelected = selectedRackId === rack.id;
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
                        if (!isPlacing) setSelectedRackId(rack.id);
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                        if (!isPlacing) setSelectedRackId(rack.id);
                      }}
                      onMouseEnter={() => {
                        if (!isPlacing) setHoveredRackId(rack.id);
                      }}
                      onMouseLeave={() => {
                        if (!isPlacing) setHoveredRackId(null);
                      }}
                      onDragStart={() => setSelectedRackId(rack.id)}
                      onDragMove={(e) => handleDragMove(rack.id, e)}
                      onDragEnd={(e) => handleDragMove(rack.id, e)}
                    >
                      <Rect x={0} y={0} width={geometry.width} height={geometry.height} fill="transparent" />

                      {faceA && <RackBody geometry={geometry} displayCode={rack.displayCode} isSelected={isSelected} isHovered={isHovered} />}
                      {lod >= 1 && faceA && <RackSections geometry={geometry} faceA={faceA} faceB={geometry.isPaired ? faceB : null} isSelected={isSelected} />}
                      {lod >= 2 && faceA && <RackCells geometry={geometry} faceA={faceA} faceB={geometry.isPaired ? faceB : null} isSelected={isSelected} />}

                      {!isPlacing && (
                        <Group
                          x={geometry.rotateHandleX}
                          y={geometry.rotateHandleY}
                          onClick={(e) => {
                            e.cancelBubble = true;
                            rotateRack(rack.id);
                            setSelectedRackId(rack.id);
                          }}
                          onTap={(e) => {
                            e.cancelBubble = true;
                            rotateRack(rack.id);
                            setSelectedRackId(rack.id);
                          }}
                        >
                          <Rect width={ROTATE_HANDLE_SIZE} height={ROTATE_HANDLE_SIZE} cornerRadius={8} fill="#ffffff" stroke={isSelected ? '#0f6a8e' : '#cbd5e1'} shadowColor="#0f172a" shadowBlur={6} shadowOpacity={0.1} />
                          <Text x={5} y={7} width={ROTATE_HANDLE_SIZE - 10} text="90В°" align="center" fontSize={10} fontStyle="bold" fill="#475569" />
                        </Group>
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
