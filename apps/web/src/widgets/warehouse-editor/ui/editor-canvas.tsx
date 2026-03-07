import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import {
  useCanvasZoom,
  useHoveredRackId,
  useLayoutDraftState,
  useRotateRack,
  useSelectedRackId,
  useSetHoveredRackId,
  useSetCanvasZoom,
  useSetSelectedRackId,
  useUpdateRackPosition
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { clampCanvasPosition, clampCanvasZoom, getRackGeometry, GRID_SIZE, ROTATE_HANDLE_SIZE } from '../lib/canvas-geometry';

export function EditorCanvas() {
  const zoom = useCanvasZoom();
  const layoutDraft = useLayoutDraftState();
  const selectedRackId = useSelectedRackId();
  const hoveredRackId = useHoveredRackId();
  const setSelectedRackId = useSetSelectedRackId();
  const setHoveredRackId = useSetHoveredRackId();
  const setCanvasZoom = useSetCanvasZoom();
  const updateRackPosition = useUpdateRackPosition();
  const rotateRack = useRotateRack();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const gridStep = GRID_SIZE * zoom;
  const racks = useMemo(() => (layoutDraft ? layoutDraft.rackIds.map((rackId) => layoutDraft.racks[rackId]) : []), [layoutDraft]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      setViewport({
        width: node.clientWidth,
        height: node.clientHeight
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const gridLines = useMemo(() => {
    if (!viewport.width || !viewport.height) {
      return { vertical: [], horizontal: [] };
    }

    const vertical = [];
    for (let x = 0; x <= viewport.width; x += gridStep) {
      vertical.push(x);
    }

    const horizontal = [];
    for (let y = 0; y <= viewport.height; y += gridStep) {
      horizontal.push(y);
    }

    return { vertical, horizontal };
  }, [gridStep, viewport.height, viewport.width]);

  const handleDragMove = (rackId: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target;
    updateRackPosition(rackId, clampCanvasPosition(node.x()), clampCanvasPosition(node.y()));
  };

  if (!layoutDraft) {
    return <div className="flex flex-1 items-center justify-center bg-slate-100 text-sm text-slate-500">Loading layout draft...</div>;
  }

  const selectedRack = selectedRackId ? layoutDraft.racks[selectedRackId] : null;

  const handleZoom = (delta: number) => {
    setCanvasZoom(clampCanvasZoom(Number((zoom + delta).toFixed(2))));
  };

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-3">
        <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Viewport</div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => handleZoom(-0.1)} className="h-9 w-9 rounded-xl border border-[var(--border-muted)] text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              -
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
          </div>
        </div>

        <div className="pointer-events-auto rounded-2xl border border-[var(--border-muted)] bg-white/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Spatial Context</div>
          {selectedRack ? (
            <div className="mt-2">
              <div className="text-sm font-semibold text-slate-900">Selected {selectedRack.displayCode}</div>
              <div className="mt-1 text-xs text-slate-600">
                {selectedRack.kind} · {selectedRack.axis} axis · {selectedRack.totalLength.toFixed(1)}m x {selectedRack.depth.toFixed(1)}m
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Position {Math.round(selectedRack.x)}, {Math.round(selectedRack.y)} · Rotation {selectedRack.rotationDeg}°
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">Select a rack to inspect position, orientation, and current surface controls.</div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-[var(--border-muted)] bg-slate-950/90 px-4 py-3 text-xs text-slate-200 shadow-[var(--shadow-soft)]">
        Drag to move · Use 90° handle to rotate · Structure stays in inspector
      </div>

      {viewport.width > 0 && viewport.height > 0 ? (
        <Stage width={viewport.width} height={viewport.height} className="h-full w-full">
          <Layer listening={false}>
            {gridLines.vertical.map((x) => (
              <Rect key={`v-${x}`} x={x} y={0} width={1} height={viewport.height} fill="#cbd5e1" opacity={0.55} />
            ))}
            {gridLines.horizontal.map((y) => (
              <Rect key={`h-${y}`} x={0} y={y} width={viewport.width} height={1} fill="#cbd5e1" opacity={0.55} />
            ))}
          </Layer>

          <Layer>
            {racks.map((rack) => {
              const geometry = getRackGeometry(rack);
              const isSelected = selectedRackId === rack.id;
              const isHovered = hoveredRackId === rack.id;

              return (
                <Group
                  key={rack.id}
                  x={geometry.x + geometry.centerX}
                  y={geometry.y + geometry.centerY}
                  offsetX={geometry.centerX}
                  offsetY={geometry.centerY}
                  rotation={rack.rotationDeg}
                  draggable
                  onClick={() => setSelectedRackId(rack.id)}
                  onTap={() => setSelectedRackId(rack.id)}
                  onMouseEnter={() => setHoveredRackId(rack.id)}
                  onMouseLeave={() => setHoveredRackId(null)}
                  onDragStart={() => setSelectedRackId(rack.id)}
                  onDragMove={(event) => handleDragMove(rack.id, event)}
                  onDragEnd={(event) => handleDragMove(rack.id, event)}
                >
                  <Rect
                    x={0}
                    y={0}
                    width={geometry.width}
                    height={geometry.height}
                    cornerRadius={10}
                    fill={isSelected ? '#dbeafe' : isHovered ? '#eff6ff' : '#ffffff'}
                    stroke={isSelected ? '#2563eb' : isHovered ? '#60a5fa' : '#cbd5e1'}
                    strokeWidth={2}
                    shadowColor="#0f172a"
                    shadowBlur={10}
                    shadowOpacity={0.08}
                    shadowOffsetY={4}
                  />
                  {isSelected ? <Rect x={6} y={6} width={geometry.width - 12} height={geometry.height - 12} cornerRadius={8} stroke="#0f6a8e" strokeWidth={1} dash={[8, 6]} opacity={0.8} listening={false} /> : null}
                  <Rect x={14} y={12} width={Math.min(geometry.width - 56, 138)} height={28} cornerRadius={999} fill="rgba(255,255,255,0.95)" shadowColor="#0f172a" shadowBlur={6} shadowOpacity={0.06} listening={false} />
                  <Text
                    x={28}
                    y={18}
                    text={`${rack.displayCode}-A`}
                    fontSize={15}
                    fontStyle="bold"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill="#0f172a"
                  />
                  <Text
                    x={14}
                    y={geometry.height - 22}
                    text={`${rack.kind.toUpperCase()} · ${rack.axis} · ${Math.round(geometry.width)}px`}
                    fontSize={11}
                    fontFamily="IBM Plex Sans, Segoe UI, sans-serif"
                    fill={isSelected ? '#0f6a8e' : '#64748b'}
                  />

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
                    <Rect width={ROTATE_HANDLE_SIZE} height={ROTATE_HANDLE_SIZE} cornerRadius={8} fill="#ffffff" stroke={isSelected ? '#0f6a8e' : '#cbd5e1'} shadowColor="#0f172a" shadowBlur={6} shadowOpacity={0.1} />
                    <Text
                      x={5}
                      y={7}
                      width={ROTATE_HANDLE_SIZE - 10}
                      text="90"
                      align="center"
                      fontSize={11}
                      fontStyle="bold"
                      fill="#475569"
                    />
                  </Group>
                </Group>
              );
            })}
          </Layer>
        </Stage>
      ) : null}
    </div>
  );
}
