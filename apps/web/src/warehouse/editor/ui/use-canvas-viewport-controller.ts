import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { MutableRefObject } from 'react';
import type { Rack } from '@wos/domain';
import type Konva from 'konva';
import type { ViewMode } from '@/warehouse/editor/model/editor-types';
import { useCameraStore } from '@/warehouse/editor/model/camera-store';
import {
  type CanvasZoomBounds,
  type CanvasCamera,
  type CanvasPoint,
  clampCanvasZoom,
  getZoomToCursorCamera,
  LOD_CELL_ENTRY,
  WORLD_SCALE
} from '@/entities/layout-version/lib/canvas-geometry';
import {
  useCanvasMaxZoom,
  useCanvasMinZoom
} from '@/app/settings/model/canvas-zoom-settings-selectors';
import { getRackBoundingBox } from '@/entities/layout-version/lib/rack-spacing';
import {
  recordCanvasCameraStoreUpdate,
  recordCanvasZoomDurableCommit,
  recordCanvasZoomTransientUpdate
} from './canvas-diagnostics';

const TRANSFORM_ONLY_ZOOM_IDLE_MS = 500;

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
  stageRef: MutableRefObject<Konva.Stage | null>;
  viewMode: ViewMode;
  zoom: number;
};

type StageOffset = {
  x: number;
  y: number;
};

type ScreenPoint = {
  x: number;
  y: number;
};

export type TransformOnlyPanState = {
  isPanning: boolean;
  panStart: ScreenPoint;
  offsetAtPanStart: StageOffset;
  liveOffset: StageOffset;
};

export type TransformOnlyZoomState = {
  isZooming: boolean;
  liveCamera: CanvasCamera;
};

export function applyTransformOnlyPanPosition(
  stage: Konva.Stage,
  offset: StageOffset
) {
  withKonvaDiagnosticsSource('stage-position', () => {
    stage.position(offset);
  });
}

export function batchDrawStageLayers(stage: Konva.Stage) {
  if (isManualPanBatchDrawDisabled()) return;

  withKonvaDiagnosticsSource('manual-pan-raf', () => {
    for (const layer of stage.getLayers()) {
      layer.batchDraw();
    }
  });
}

export function batchDrawStageLayersWithSource(
  stage: Konva.Stage,
  source: string
) {
  withKonvaDiagnosticsSource(source, () => {
    for (const layer of stage.getLayers()) {
      layer.batchDraw();
    }
  });
}

export function isStageCameraOffsetSynced(
  stage: Konva.Stage,
  offset: StageOffset
) {
  return stage.x() === offset.x && stage.y() === offset.y;
}

export function createTransformOnlyPanState(
  initialOffset: StageOffset = { x: 0, y: 0 }
): TransformOnlyPanState {
  return {
    isPanning: false,
    panStart: { x: 0, y: 0 },
    offsetAtPanStart: initialOffset,
    liveOffset: initialOffset
  };
}

export function createTransformOnlyZoomState(
  initialCamera: CanvasCamera = { zoom: 1, offsetX: 0, offsetY: 0 }
): TransformOnlyZoomState {
  return {
    isZooming: false,
    liveCamera: initialCamera
  };
}

function isManualPanBatchDrawDisabled() {
  return (
    typeof window !== 'undefined' &&
    window.__WOS_CANVAS_DISABLE_MANUAL_PAN_BATCH_DRAW__ === true
  );
}

function withKonvaDiagnosticsSource<T>(source: string, callback: () => T): T {
  if (typeof window === 'undefined') {
    return callback();
  }

  const previous = window.__WOS_CANVAS_KONVA_SOURCE__ ?? null;
  window.__WOS_CANVAS_KONVA_SOURCE__ = source;
  try {
    return callback();
  } finally {
    window.__WOS_CANVAS_KONVA_SOURCE__ = previous;
  }
}

export function startTransformOnlyPan({
  committedOffset,
  pointer,
  stage,
  state
}: {
  committedOffset: StageOffset;
  pointer: ScreenPoint;
  stage: Konva.Stage;
  state: TransformOnlyPanState;
}) {
  state.isPanning = true;
  state.panStart = pointer;
  state.offsetAtPanStart = committedOffset;
  state.liveOffset = committedOffset;
  applyTransformOnlyPanPosition(stage, state.liveOffset);
}

export function moveTransformOnlyPan({
  pointer,
  scheduleDraw,
  stage,
  state
}: {
  pointer: ScreenPoint;
  scheduleDraw: () => void;
  stage: Konva.Stage;
  state: TransformOnlyPanState;
}) {
  if (!state.isPanning) return null;
  state.liveOffset = {
    x: state.offsetAtPanStart.x + pointer.x - state.panStart.x,
    y: state.offsetAtPanStart.y + pointer.y - state.panStart.y
  };
  applyTransformOnlyPanPosition(stage, state.liveOffset);
  scheduleDraw();
  return state.liveOffset;
}

export function finishTransformOnlyPan({
  cancelDraw,
  commitOffset,
  recordOffsetCommit,
  stage,
  state
}: {
  cancelDraw: () => void;
  commitOffset: (offset: StageOffset) => void;
  recordOffsetCommit: () => void;
  stage: Konva.Stage | null;
  state: TransformOnlyPanState;
}) {
  if (!state.isPanning) return null;
  state.isPanning = false;
  cancelDraw();
  const finalOffset = state.liveOffset;
  if (stage) {
    applyTransformOnlyPanPosition(stage, finalOffset);
  }
  commitOffset(finalOffset);
  recordOffsetCommit();
  if (stage && !isStageCameraOffsetSynced(stage, finalOffset)) {
    applyTransformOnlyPanPosition(stage, finalOffset);
  }
  return finalOffset;
}

export function applyTransformOnlyZoomCamera(
  stage: Konva.Stage,
  camera: CanvasCamera
) {
  withKonvaDiagnosticsSource('stage-camera', () => {
    stage.scale({ x: camera.zoom, y: camera.zoom });
    stage.position({ x: camera.offsetX, y: camera.offsetY });
  });
}

export function updateTransformOnlyZoom({
  committedCamera,
  cursor,
  nextZoom,
  scheduleDraw,
  stage,
  state
}: {
  committedCamera: CanvasCamera;
  cursor: CanvasPoint;
  nextZoom: number;
  scheduleDraw: () => void;
  stage: Konva.Stage;
  state: TransformOnlyZoomState;
}) {
  const baseCamera = state.isZooming ? state.liveCamera : committedCamera;
  const nextCamera = getZoomToCursorCamera(baseCamera, cursor, nextZoom);
  state.isZooming = true;
  state.liveCamera = nextCamera;
  applyTransformOnlyZoomCamera(stage, nextCamera);
  scheduleDraw();
  return nextCamera;
}

export function finishTransformOnlyZoom({
  cancelDraw,
  commitCamera,
  recordCameraCommit,
  stage,
  state
}: {
  cancelDraw: () => void;
  commitCamera: (camera: CanvasCamera) => void;
  recordCameraCommit: () => void;
  stage: Konva.Stage | null;
  state: TransformOnlyZoomState;
}) {
  if (!state.isZooming) return null;
  state.isZooming = false;
  cancelDraw();
  const finalCamera = state.liveCamera;
  if (stage) {
    applyTransformOnlyZoomCamera(stage, finalCamera);
  }
  commitCamera(finalCamera);
  recordCameraCommit();
  return finalCamera;
}

export function getModeEntryMinZoom(viewMode: ViewMode): number {
  return viewMode === 'view' ? LOD_CELL_ENTRY : 0;
}

export function useCanvasViewportController({
  autoFitRacks,
  setCanvasZoom,
  stageRef,
  viewMode,
  zoom
}: UseCanvasViewportControllerParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ width: 0, height: 0 });
  const minZoom = useCanvasMinZoom();
  const maxZoom = useCanvasMaxZoom();
  const zoomBounds = useMemo<CanvasZoomBounds>(
    () => ({ minZoom, maxZoom }),
    [minZoom, maxZoom]
  );
  const zoomBoundsRef = useRef(zoomBounds);
  zoomBoundsRef.current = zoomBounds;

  // Camera offset is now owned by useCameraStore. Subscribe to offsetX/offsetY
  // with individual selectors so this hook only re-renders when values change.
  const offsetX = useCameraStore((s) => s.offsetX);
  const offsetY = useCameraStore((s) => s.offsetY);
  // Stable object reference — only changes when the underlying values change,
  // matching the previous useState behaviour.
  const canvasOffset = useMemo<CanvasOffset>(
    () => ({ x: offsetX, y: offsetY }),
    [offsetX, offsetY]
  );

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStateRef = useRef(
    createTransformOnlyPanState({ x: offsetX, y: offsetY })
  );
  const zoomStateRef = useRef(
    createTransformOnlyZoomState({ zoom, offsetX, offsetY })
  );
  const panFrameRef = useRef<number | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const zoomIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPanActiveRef = useRef(false);
  const pinchStartDistRef = useRef<number | null>(null);

  // Track previous viewMode so we can detect the transition TO placement.
  const prevViewModeRef = useRef(viewMode);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setCanvasZoomRef = useRef(setCanvasZoom);
  setCanvasZoomRef.current = setCanvasZoom;

  useLayoutEffect(() => {
    const state = zoomStateRef.current;
    const stage = stageRef.current;
    if (!state.isZooming || !stage) return;

    applyTransformOnlyZoomCamera(stage, state.liveCamera);
  });

  useEffect(() => {
    const nextZoom = clampCanvasZoom(zoom, zoomBounds);
    if (nextZoom !== zoom) {
      setCanvasZoom(nextZoom);
    }
  }, [setCanvasZoom, zoom, zoomBounds]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Auto-fit when entering View/Storage.
  // View mode keeps the cell-visible floor; Storage mode stays rack-friendly.
  useEffect(() => {
    const prevMode = prevViewModeRef.current;
    prevViewModeRef.current = viewMode;

    // Only fire on the transition from Layout to View/Storage, not on every render.
    if ((viewMode !== 'view' && viewMode !== 'storage') || prevMode !== 'layout') return;
    if (viewport.width === 0) return;

    // Selection is already cleared by setViewMode() in the store.
    // This effect only handles mode-entry auto-fit.
    const racks = autoFitRacks;
    const minEntryZoom = getModeEntryMinZoom(viewMode);

    if (racks.length === 0) {
      setCanvasZoom(clampCanvasZoom(Math.max(zoom, minEntryZoom), zoomBoundsRef.current));
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

    const scaleX = bboxWPx > 0 ? (viewport.width - PADDING * 2) / bboxWPx : minEntryZoom;
    const scaleY = bboxHPx > 0 ? (viewport.height - PADDING * 2) / bboxHPx : minEntryZoom;

    const targetZoom = clampCanvasZoom(
      Math.max(Math.min(scaleX, scaleY), minEntryZoom),
      zoomBoundsRef.current
    );

    const newOffsetX = (viewport.width - bboxWPx * targetZoom) / 2 - minXm * WORLD_SCALE * targetZoom;
    const newOffsetY = (viewport.height - bboxHPx * targetZoom) / 2 - minYm * WORLD_SCALE * targetZoom;

    // Atomic camera update — zoom and offset written in a single store transaction.
    useCameraStore.getState().setCamera(targetZoom, newOffsetX, newOffsetY);
    recordCanvasCameraStoreUpdate('camera');
  }, [viewMode]);
  // Intentionally reads viewport/autoFitRacks/zoom via closure at transition time —
  // re-running on their changes would fight the user's manual zoom adjustments.

  // Wheel/pinch zoom is transform-only while active. The camera store is updated
  // once on idle so RackLayer culling and full render mode catch up after the burst.
  const cancelScheduledZoomDraw = useCallback(() => {
    if (zoomFrameRef.current === null) return;
    window.cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = null;
  }, []);

  const scheduleZoomDraw = useCallback(() => {
    if (zoomFrameRef.current !== null) return;
    zoomFrameRef.current = window.requestAnimationFrame(() => {
      zoomFrameRef.current = null;
      const stage = stageRef.current;
      if (!stage || !zoomStateRef.current.isZooming) return;
      batchDrawStageLayersWithSource(stage, 'manual-zoom-raf');
    });
  }, [stageRef]);

  const commitTransformOnlyZoom = useCallback(() => {
    if (zoomIdleTimerRef.current !== null) {
      globalThis.clearTimeout(zoomIdleTimerRef.current);
      zoomIdleTimerRef.current = null;
    }

    return finishTransformOnlyZoom({
      cancelDraw: cancelScheduledZoomDraw,
      commitCamera: (camera) => {
        useCameraStore
          .getState()
          .setCamera(camera.zoom, camera.offsetX, camera.offsetY);
      },
      recordCameraCommit: () => {
        recordCanvasCameraStoreUpdate('camera');
        recordCanvasZoomDurableCommit();
      },
      stage: stageRef.current,
      state: zoomStateRef.current
    });
  }, [cancelScheduledZoomDraw, stageRef]);

  const scheduleZoomCommit = useCallback(() => {
    if (zoomIdleTimerRef.current !== null) {
      globalThis.clearTimeout(zoomIdleTimerRef.current);
    }
    zoomIdleTimerRef.current = globalThis.setTimeout(() => {
      zoomIdleTimerRef.current = null;
      commitTransformOnlyZoom();
    }, TRANSFORM_ONLY_ZOOM_IDLE_MS);
  }, [commitTransformOnlyZoom]);

  const handleZoom = useCallback(
    (delta: number, cursor?: CanvasPoint) => {
      const stage = stageRef.current;
      const activeZoomState = zoomStateRef.current;
      const currentZoom = activeZoomState.isZooming
        ? activeZoomState.liveCamera.zoom
        : zoomRef.current;
      const nextZoom = clampCanvasZoom(
        Number((currentZoom + delta).toFixed(2)),
        zoomBoundsRef.current
      );

      if (!cursor || !stage) {
        commitTransformOnlyZoom();
        setCanvasZoomRef.current(nextZoom);
        return;
      }

      const camera = useCameraStore.getState();
      updateTransformOnlyZoom({
        committedCamera: {
          zoom: camera.zoom,
          offsetX: camera.offsetX,
          offsetY: camera.offsetY
        },
        cursor,
        nextZoom,
        scheduleDraw: scheduleZoomDraw,
        stage,
        state: activeZoomState
      });
      recordCanvasZoomTransientUpdate();
      scheduleZoomCommit();
    },
    [commitTransformOnlyZoom, scheduleZoomCommit, scheduleZoomDraw, stageRef]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cancelScheduledPanDraw = () => {
      if (panFrameRef.current === null) return;
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    };

    const schedulePanDraw = () => {
      if (panFrameRef.current !== null) return;
      panFrameRef.current = window.requestAnimationFrame(() => {
        panFrameRef.current = null;
        const stage = stageRef.current;
        if (!stage || !isPanningRef.current) return;
        batchDrawStageLayers(stage);
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      const stage = stageRef.current;
      if (!stage) return;
      commitTransformOnlyZoom();
      isPanningRef.current = true;
      // Snapshot current offset at pan start via getState() — avoids stale closures
      // without needing a ref that mirrors the store value.
      const { offsetX: ox, offsetY: oy } = useCameraStore.getState();
      startTransformOnlyPan({
        committedOffset: { x: ox, y: oy },
        pointer: { x: event.clientX, y: event.clientY },
        stage,
        state: panStateRef.current
      });
      setIsPanning(true);
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isPanningRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;
      moveTransformOnlyPan({
        pointer: { x: event.clientX, y: event.clientY },
        scheduleDraw: schedulePanDraw,
        stage,
        state: panStateRef.current
      });
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) return;
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      finishTransformOnlyPan({
        cancelDraw: cancelScheduledPanDraw,
        commitOffset: (offset) => {
          useCameraStore.getState().setOffset(offset.x, offset.y);
        },
        recordOffsetCommit: () => recordCanvasCameraStoreUpdate('offset'),
        stage: stageRef.current,
        state: panStateRef.current
      });
      setIsPanning(false);
    };

    const onTouchStart = (event: TouchEvent) => {
      const stage = stageRef.current;
      if (!stage) return;

      if (event.touches.length === 2) {
        // Cancel any in-progress 1-finger pan
        if (isPanningRef.current) {
          isPanningRef.current = false;
          touchPanActiveRef.current = false;
          setIsPanning(false);
        }
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        pinchStartDistRef.current = Math.hypot(dx, dy);
        event.preventDefault();
        return;
      }

      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const box = stage.container().getBoundingClientRect();
      // Only pan when touching the canvas background (not a shape)
      const hit = stage.getIntersection({ x: touch.clientX - box.left, y: touch.clientY - box.top });
      if (hit) return;

      touchPanActiveRef.current = true;
      isPanningRef.current = true;
      commitTransformOnlyZoom();
      const { offsetX: ox, offsetY: oy } = useCameraStore.getState();
      startTransformOnlyPan({
        committedOffset: { x: ox, y: oy },
        pointer: { x: touch.clientX, y: touch.clientY },
        stage,
        state: panStateRef.current
      });
      setIsPanning(true);
      event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      const stage = stageRef.current;
      if (!stage) return;

      if (event.touches.length === 2 && pinchStartDistRef.current !== null) {
        if (isPanningRef.current) {
          isPanningRef.current = false;
          touchPanActiveRef.current = false;
          setIsPanning(false);
        }
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const delta = (newDist - pinchStartDistRef.current) * 0.005;
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const box = stage.container().getBoundingClientRect();
        handleZoom(delta, { x: midX - box.left, y: midY - box.top });
        pinchStartDistRef.current = newDist;
        event.preventDefault();
        return;
      }

      if (!touchPanActiveRef.current || !isPanningRef.current) return;
      if (event.touches.length !== 1) return;
      moveTransformOnlyPan({
        pointer: { x: event.touches[0].clientX, y: event.touches[0].clientY },
        scheduleDraw: schedulePanDraw,
        stage,
        state: panStateRef.current
      });
      event.preventDefault();
    };

    const onTouchEnd = () => {
      pinchStartDistRef.current = null;
      if (!touchPanActiveRef.current) return;
      touchPanActiveRef.current = false;
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      finishTransformOnlyPan({
        cancelDraw: cancelScheduledPanDraw,
        commitOffset: (offset) => {
          useCameraStore.getState().setOffset(offset.x, offset.y);
        },
        recordOffsetCommit: () => recordCanvasCameraStoreUpdate('offset'),
        stage: stageRef.current,
        state: panStateRef.current
      });
      setIsPanning(false);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelScheduledPanDraw();
      if (zoomIdleTimerRef.current !== null) {
        globalThis.clearTimeout(zoomIdleTimerRef.current);
        zoomIdleTimerRef.current = null;
      }
      cancelScheduledZoomDraw();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [
    stageRef,
    handleZoom,
    commitTransformOnlyZoom,
    cancelScheduledZoomDraw
  ]);

  return {
    containerRef,
    viewport,
    canvasOffset,
    isPanning,
    handleZoom
  };
}
