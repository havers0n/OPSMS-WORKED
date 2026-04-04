import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rack } from '@wos/domain';
import type { ViewMode } from '@/entities/layout-version/model/editor-types';
import {
  clampCanvasZoom,
  LOD_CELL_THRESHOLD,
  WORLD_SCALE
} from '../lib/canvas-geometry';
import { getRackBoundingBox } from '../lib/rack-spacing';

type CanvasViewport = {
  width: number;
  height: number;
};

type CanvasOffset = {
  x: number;
  y: number;
};

type UseCanvasViewportControllerParams = {
  autoFitRacks: Rack[];
  setCanvasZoom: (zoom: number) => void;
  viewMode: ViewMode;
  zoom: number;
};

export function useCanvasViewportController({
  autoFitRacks,
  setCanvasZoom,
  viewMode,
  zoom
}: UseCanvasViewportControllerParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ width: 0, height: 0 });

  const [canvasOffset, setCanvasOffset] = useState<CanvasOffset>({ x: 0, y: 0 });
  const canvasOffsetRef = useRef<CanvasOffset>({ x: 0, y: 0 });
  canvasOffsetRef.current = canvasOffset;

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const offsetAtPanStartRef = useRef({ x: 0, y: 0 });

  // Track previous viewMode so we can detect the transition TO placement.
  const prevViewModeRef = useRef(viewMode);

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

  // Auto-zoom to cell-visible level when entering View/Storage.
  // Ensures cells are always visible on mode entry without requiring manual zoom.
  useEffect(() => {
    const prevMode = prevViewModeRef.current;
    prevViewModeRef.current = viewMode;

    // Only fire on the transition from Layout to View/Storage, not on every render.
    if ((viewMode !== 'view' && viewMode !== 'storage') || prevMode !== 'layout') return;
    if (viewport.width === 0) return;

    // Selection is already cleared by setViewMode() in the store.
    // This effect only handles the auto-zoom to cell-visible level.
    const racks = autoFitRacks;

    if (racks.length === 0) {
      // No racks yet — just ensure cells would be visible if any appear.
      setCanvasZoom(clampCanvasZoom(Math.max(zoom, LOD_CELL_THRESHOLD)));
      return;
    }

    // getRackBoundingBox returns metres; convert to pixels for viewport math
    const boxes = racks.map(getRackBoundingBox);
    const minXm = Math.min(...boxes.map((b) => b.minX));
    const maxXm = Math.max(...boxes.map((b) => b.maxX));
    const minYm = Math.min(...boxes.map((b) => b.minY));
    const maxYm = Math.max(...boxes.map((b) => b.maxY));

    const PADDING = 80; // px on each side
    const bboxWPx = (maxXm - minXm) * WORLD_SCALE;
    const bboxHPx = (maxYm - minYm) * WORLD_SCALE;

    const scaleX = bboxWPx > 0 ? (viewport.width - PADDING * 2) / bboxWPx : LOD_CELL_THRESHOLD;
    const scaleY = bboxHPx > 0 ? (viewport.height - PADDING * 2) / bboxHPx : LOD_CELL_THRESHOLD;

    // Never go below LOD_CELL_THRESHOLD — cells must be visible in this mode.
    const targetZoom = clampCanvasZoom(Math.max(Math.min(scaleX, scaleY), LOD_CELL_THRESHOLD));

    const offsetX = (viewport.width - bboxWPx * targetZoom) / 2 - minXm * WORLD_SCALE * targetZoom;
    const offsetY = (viewport.height - bboxHPx * targetZoom) / 2 - minYm * WORLD_SCALE * targetZoom;

    setCanvasZoom(targetZoom);
    setCanvasOffset({ x: offsetX, y: offsetY });
  }, [viewMode]);
  // Intentionally reads viewport/autoFitRacks/zoom via closure at transition time —
  // re-running on their changes would fight the user's manual zoom adjustments.

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

  const handleZoom = useCallback((delta: number) => {
    setCanvasZoomRef.current(
      clampCanvasZoom(Number((zoomRef.current + delta).toFixed(2)))
    );
  }, []);

  return {
    containerRef,
    viewport,
    canvasOffset,
    isPanning,
    handleZoom
  };
}
