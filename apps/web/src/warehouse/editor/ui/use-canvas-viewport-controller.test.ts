// @vitest-environment jsdom
import type Konva from 'konva';
import type { Rack } from '@wos/domain';
import { render, fireEvent, act } from '@testing-library/react';
import { createElement, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  getCanvasLOD,
  isRackInViewport,
  LOD_CELL_ENTRY
} from '@/entities/layout-version/lib/canvas-geometry';
import { useCameraStore } from '@/warehouse/editor/model/camera-store';
import { getStorageOccupancyOverlayLod } from './shapes/storage-occupancy-overlay';
import {
  batchDrawStageLayers,
  createTransformOnlyZoomState,
  createTransformOnlyPanState,
  finishTransformOnlyPan,
  finishTransformOnlyZoom,
  getModeEntryCamera,
  getModeEntryMinZoom,
  isStageCameraOffsetSynced,
  moveTransformOnlyPan,
  shouldQueueModeEntryAutoFit,
  startTransformOnlyPan,
  useCanvasViewportController,
  updateTransformOnlyZoom
} from './use-canvas-viewport-controller';
import { useCanvasZoomSettingsStore } from '@/app/settings/model/canvas-zoom-settings';

type FakeStage = Konva.Stage & {
  __position: { x: number; y: number };
  __scale: { x: number; y: number };
  __batchDraw: ReturnType<typeof vi.fn>;
};

function createFakeStage(initial = { x: 0, y: 0 }) {
  const batchDraw = vi.fn();
  let position = { ...initial };
  let scale = { x: 1, y: 1 };
  const stage = {
    get __position() {
      return position;
    },
    __batchDraw: batchDraw,
    get __scale() {
      return scale;
    },
    position(next?: { x: number; y: number }) {
      if (next) {
        position = { ...next };
      }
      return position;
    },
    scale(next?: { x: number; y: number }) {
      if (next) {
        scale = { ...next };
      }
      return scale;
    },
    x() {
      return position.x;
    },
    y() {
      return position.y;
    },
    getLayers() {
      return [{ batchDraw }];
    }
  } as unknown as FakeStage;

  return stage;
}

function createInteractiveStage(
  containerRef: { current: HTMLDivElement | null },
  initial = { x: 0, y: 0 }
) {
  let position = { ...initial };
  const stage = {
    container: () => containerRef.current as HTMLDivElement,
    getIntersection: () => null,
    getLayers: () => [{ batchDraw: vi.fn() }],
    position(next?: { x: number; y: number }) {
      if (next) position = { ...next };
      return position;
    },
    scale() {
      return { x: 1, y: 1 };
    },
    x() {
      return position.x;
    },
    y() {
      return position.y;
    }
  } as unknown as Konva.Stage;
  return stage;
}

function createDl1LikeRack(index: number): Rack {
  return {
    id: `rack-${index}`,
    code: `R${String(index + 1).padStart(2, '0')}`,
    x: index * 4,
    y: 0,
    width: 3,
    depth: 1.2,
    rotation: 0,
    rotationDeg: 0,
    kind: 'single',
    totalLength: 3,
    faces: [],
    status: 'active'
  } as unknown as Rack;
}

describe('getModeEntryMinZoom', () => {
  it('keeps cell-visible floor for view mode', () => {
    expect(getModeEntryMinZoom('view')).toBe(LOD_CELL_ENTRY);
  });

  it('does not force cell-visible floor for storage mode', () => {
    expect(getModeEntryMinZoom('storage')).toBe(0);
  });

  it('does not apply entry floor in layout mode', () => {
    expect(getModeEntryMinZoom('layout')).toBe(0);
  });
});

describe('storage mode entry auto-fit policy', () => {
  it('queues overview fit when storage mounts without focused location', () => {
    expect(
      shouldQueueModeEntryAutoFit({
        previousViewMode: null,
        viewMode: 'storage',
        hasStorageFocus: false
      })
    ).toBe(true);
  });

  it('queues overview fit when entering storage from layout without focus', () => {
    expect(
      shouldQueueModeEntryAutoFit({
        previousViewMode: 'layout',
        viewMode: 'storage',
        hasStorageFocus: false
      })
    ).toBe(true);
  });

  it('does not queue storage overview fit when an explicit focus exists', () => {
    expect(
      shouldQueueModeEntryAutoFit({
        previousViewMode: 'layout',
        viewMode: 'storage',
        hasStorageFocus: true
      })
    ).toBe(false);
  });

  it('fits a DL1-like storage overview below the default zoom and keeps overlay visible', () => {
    const racks = Array.from({ length: 10 }, (_, index) =>
      createDl1LikeRack(index)
    );
    const viewport = { width: 1000, height: 800 };
    const camera = getModeEntryCamera({
      currentOffset: { x: 0, y: 0 },
      racks,
      viewMode: 'storage',
      viewport,
      zoom: 1,
      zoomBounds: { minZoom: 0.1, maxZoom: 3 }
    });

    expect(camera).not.toBeNull();
    expect(camera!.zoom).toBeCloseTo(0.54, 2);
    expect(camera!.zoom).toBeLessThan(1);
    expect(getCanvasLOD(camera!.zoom)).toBe(0);
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'full',
        zoom: camera!.zoom
      })
    ).toBe('cell-compact');

    const visibleRackCount = racks.filter((rack) =>
      isRackInViewport(
        rack,
        viewport,
        {
          x: camera!.offsetX,
          y: camera!.offsetY
        },
        camera!.zoom,
        0
      )
    ).length;

    expect(visibleRackCount).toBeGreaterThanOrEqual(8);
    expect(visibleRackCount).toBeLessThanOrEqual(10);
  });
});

describe('transform-only zoom helpers', () => {
  it('applies cursor-preserving zoom to the Stage without committing until idle', () => {
    const stage = createFakeStage({ x: 10, y: 20 });
    const state = createTransformOnlyZoomState({
      zoom: 1,
      offsetX: 10,
      offsetY: 20
    });
    const scheduleDraw = vi.fn();
    const commitCamera = vi.fn();
    const recordCameraCommit = vi.fn();
    const cancelDraw = vi.fn();

    const liveCamera = updateTransformOnlyZoom({
      committedCamera: { zoom: 1, offsetX: 10, offsetY: 20 },
      cursor: { x: 110, y: 220 },
      nextZoom: 1.5,
      scheduleDraw,
      stage,
      state
    });

    expect(liveCamera).toEqual({ zoom: 1.5, offsetX: -40, offsetY: -80 });
    expect(stage.__scale).toEqual({ x: 1.5, y: 1.5 });
    expect(stage.__position).toEqual({ x: -40, y: -80 });
    expect(scheduleDraw).toHaveBeenCalledOnce();
    expect(commitCamera).not.toHaveBeenCalled();

    const finalCamera = finishTransformOnlyZoom({
      cancelDraw,
      commitCamera,
      recordCameraCommit,
      stage,
      state
    });

    expect(finalCamera).toEqual(liveCamera);
    expect(commitCamera).toHaveBeenCalledWith(liveCamera);
    expect(recordCameraCommit).toHaveBeenCalledOnce();
    expect(cancelDraw).toHaveBeenCalledOnce();
  });

  it('chains repeated wheel ticks from the live transient camera', () => {
    const stage = createFakeStage({ x: 0, y: 0 });
    const state = createTransformOnlyZoomState({
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    });

    updateTransformOnlyZoom({
      committedCamera: { zoom: 1, offsetX: 0, offsetY: 0 },
      cursor: { x: 100, y: 100 },
      nextZoom: 1.1,
      scheduleDraw: () => undefined,
      stage,
      state
    });
    const second = updateTransformOnlyZoom({
      committedCamera: { zoom: 1, offsetX: 0, offsetY: 0 },
      cursor: { x: 100, y: 100 },
      nextZoom: 1.2,
      scheduleDraw: () => undefined,
      stage,
      state
    });

    expect(second.zoom).toBe(1.2);
    expect(second.offsetX).toBeCloseTo(-20);
    expect(second.offsetY).toBeCloseTo(-20);
  });

  it('keeps post-zoom hit targeting aligned with the final committed camera', () => {
    const stage = createFakeStage({ x: 0, y: 0 });
    const state = createTransformOnlyZoomState({
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    });
    let committedCamera = { zoom: 1, offsetX: 0, offsetY: 0 };

    updateTransformOnlyZoom({
      committedCamera,
      cursor: { x: 160, y: 120 },
      nextZoom: 1.4,
      scheduleDraw: () => undefined,
      stage,
      state
    });
    finishTransformOnlyZoom({
      cancelDraw: () => undefined,
      commitCamera: (camera) => {
        committedCamera = camera;
      },
      recordCameraCommit: () => undefined,
      stage,
      state
    });

    const screenPoint = { x: 240, y: 200 };
    const worldFromStore = {
      x: (screenPoint.x - committedCamera.offsetX) / committedCamera.zoom,
      y: (screenPoint.y - committedCamera.offsetY) / committedCamera.zoom
    };
    const worldFromStage = {
      x: (screenPoint.x - stage.x()) / stage.__scale.x,
      y: (screenPoint.y - stage.y()) / stage.__scale.y
    };

    expect(worldFromStage).toEqual(worldFromStore);
  });
});

describe('transform-only pan helpers', () => {
  it('batch draws each Stage layer for an imperative pan frame', () => {
    const stage = createFakeStage();

    batchDrawStageLayers(stage);

    expect(stage.__batchDraw).toHaveBeenCalledTimes(1);
  });

  it('moves the Stage imperatively without committing camera offset until pan end', () => {
    const stage = createFakeStage({ x: 10, y: 20 });
    const state = createTransformOnlyPanState({ x: 10, y: 20 });
    const scheduleDraw = vi.fn();
    const commitOffset = vi.fn();
    const recordOffsetCommit = vi.fn();
    const cancelDraw = vi.fn();

    startTransformOnlyPan({
      committedOffset: { x: 10, y: 20 },
      pointer: { x: 100, y: 100 },
      stage,
      state
    });
    const liveOffset = moveTransformOnlyPan({
      pointer: { x: 145, y: 112 },
      scheduleDraw,
      stage,
      state
    });

    expect(liveOffset).toEqual({ x: 55, y: 32 });
    expect(stage.__position).toEqual({ x: 55, y: 32 });
    expect(scheduleDraw).toHaveBeenCalledTimes(1);
    expect(commitOffset).not.toHaveBeenCalled();
    expect(recordOffsetCommit).not.toHaveBeenCalled();

    const finalOffset = finishTransformOnlyPan({
      cancelDraw,
      commitOffset,
      recordOffsetCommit,
      stage,
      state
    });

    expect(finalOffset).toEqual({ x: 55, y: 32 });
    expect(commitOffset).toHaveBeenCalledOnce();
    expect(commitOffset).toHaveBeenCalledWith({ x: 55, y: 32 });
    expect(recordOffsetCommit).toHaveBeenCalledOnce();
    expect(cancelDraw).toHaveBeenCalledOnce();
    expect(isStageCameraOffsetSynced(stage, { x: 55, y: 32 })).toBe(true);
  });

  it('keeps post-pan hit targeting aligned with the final committed offset', () => {
    const stage = createFakeStage({ x: 0, y: 0 });
    const state = createTransformOnlyPanState({ x: 0, y: 0 });
    let committedOffset = { x: 0, y: 0 };

    startTransformOnlyPan({
      committedOffset,
      pointer: { x: 100, y: 100 },
      stage,
      state
    });
    moveTransformOnlyPan({
      pointer: { x: 160, y: 130 },
      scheduleDraw: () => undefined,
      stage,
      state
    });
    finishTransformOnlyPan({
      cancelDraw: () => undefined,
      commitOffset: (offset) => {
        committedOffset = offset;
      },
      recordOffsetCommit: () => undefined,
      stage,
      state
    });

    const screenPoint = { x: 260, y: 190 };
    const worldFromStore = {
      x: screenPoint.x - committedOffset.x,
      y: screenPoint.y - committedOffset.y
    };
    const worldFromStage = {
      x: screenPoint.x - stage.x(),
      y: screenPoint.y - stage.y()
    };

    expect(stage.__position).toEqual({ x: 60, y: 30 });
    expect(worldFromStage).toEqual(worldFromStore);
  });
});

describe('useCanvasViewportController desktop pan threshold', () => {
  it('keeps click/below-threshold move non-panning, enters panning at threshold once, resets on mouseup, and supports next drag', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const stageContainerRef: { current: HTMLDivElement | null } = { current: null };
    const stageRef = { current: createInteractiveStage(stageContainerRef) };
    const panningSnapshots: boolean[] = [];
    const setOffsetSpy = vi.spyOn(useCameraStore.getState(), 'setOffset');
    const nowSpy = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => 1000);

    useCameraStore.setState({ zoom: 1, offsetX: 0, offsetY: 0 });
    useCanvasZoomSettingsStore.setState({ minZoom: 0.1, maxZoom: 3 });

    function Harness() {
      const controller = useCanvasViewportController({
        autoFitRacks: [],
        setCanvasZoom: () => undefined,
        stageRef: stageRef as MutableRefObject<Konva.Stage | null>,
        viewMode: 'layout',
        zoom: 1
      });
      const mountedRef = useRef(false);
      useEffect(() => {
        if (!mountedRef.current) {
          mountedRef.current = true;
          return;
        }
        panningSnapshots.push(controller.isPanning);
      }, [controller.isPanning]);
      return createElement('div', {
        ref: (node: HTMLDivElement | null) => {
          stageContainerRef.current = node;
          controller.containerRef.current = node;
        }
      });
    }

    const rendered = render(createElement(Harness));
    const container = rendered.container.firstElementChild as HTMLDivElement;
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600
      }) as DOMRect;

    act(() => {
      fireEvent.mouseDown(container, { button: 0, clientX: 100, clientY: 100 });
    });
    expect(panningSnapshots).toEqual([]);

    act(() => {
      fireEvent.mouseMove(window, { clientX: 104, clientY: 100 });
    });
    expect(panningSnapshots).toEqual([]);

    act(() => {
      fireEvent.mouseMove(window, { clientX: 106, clientY: 100 });
    });
    expect(panningSnapshots).toEqual([true]);

    act(() => {
      fireEvent.mouseMove(window, { clientX: 120, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 130, clientY: 100 });
    });
    expect(panningSnapshots).toEqual([true]);

    act(() => {
      fireEvent.mouseUp(window, { button: 0 });
    });
    expect(panningSnapshots).toEqual([true, false]);
    expect(setOffsetSpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.mouseDown(container, { button: 0, clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 56, clientY: 50 });
    });
    expect(panningSnapshots).toEqual([true, false, true]);

    act(() => {
      fireEvent.mouseUp(window, { button: 0 });
    });
    expect(panningSnapshots).toEqual([true, false, true, false]);
    expect(setOffsetSpy).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
    setOffsetSpy.mockRestore();
    rendered.unmount();
    globalThis.ResizeObserver = originalResizeObserver;
  });
});

describe('commitInteractionsForExternalCamera', () => {
  it('cancels an in-flight inertia RAF so programmatic camera jump is not overwritten', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    vi.useFakeTimers();
    const rafIds: number[] = [];
    const cancelledRafIds: number[] = [];
    let rafCounter = 0;
    const originalRaf = window.requestAnimationFrame;
    const originalCaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = (cb) => {
      const id = ++rafCounter;
      rafIds.push(id);
      // Schedule via setTimeout so fake timers control it
      globalThis.setTimeout(() => cb(id), 16);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      cancelledRafIds.push(id);
      globalThis.clearTimeout(id);
    };

    const stageContainerRef: { current: HTMLDivElement | null } = { current: null };
    const stageRef = { current: createInteractiveStage(stageContainerRef) };
    useCameraStore.setState({ zoom: 1, offsetX: 0, offsetY: 0 });
    useCanvasZoomSettingsStore.setState({ minZoom: 0.1, maxZoom: 3 });

    let commitInteractions: (() => void) | null = null;

    function Harness() {
      const controller = useCanvasViewportController({
        autoFitRacks: [],
        setCanvasZoom: () => undefined,
        stageRef: stageRef as MutableRefObject<Konva.Stage | null>,
        viewMode: 'storage',
        zoom: 1
      });
      useEffect(() => {
        commitInteractions = controller.commitInteractionsForExternalCamera;
      });
      const ref = controller.containerRef;
      return createElement('div', { ref });
    }

    const rendered = render(createElement(Harness));
    const container = rendered.container.firstElementChild as HTMLDivElement;
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
    stageContainerRef.current = container;

    // Simulate a fast pan that triggers inertia
    act(() => {
      fireEvent.mouseDown(container, { button: 0, clientX: 100, clientY: 100 });
    });
    act(() => {
      fireEvent.mouseMove(window, { clientX: 110, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 140, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 200, clientY: 100 });
    });
    act(() => {
      fireEvent.mouseUp(window, { button: 0, clientX: 200, clientY: 100 });
    });

    // Inertia RAF should be scheduled
    const rafIdsBefore = rafIds.length;
    expect(rafIdsBefore).toBeGreaterThan(0);

    // commitInteractionsForExternalCamera should cancel the inertia RAF
    act(() => {
      commitInteractions?.();
    });

    expect(cancelledRafIds.length).toBeGreaterThan(0);

    // Advance timers — inertia should NOT call setOffset because it was cancelled
    const setOffsetSpy = vi.spyOn(useCameraStore.getState(), 'setOffset');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(setOffsetSpy).not.toHaveBeenCalled();

    setOffsetSpy.mockRestore();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
    vi.useRealTimers();
    rendered.unmount();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('is a stable callback reference across re-renders', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const stageRef = { current: null as Konva.Stage | null };
    useCameraStore.setState({ zoom: 1, offsetX: 0, offsetY: 0 });
    useCanvasZoomSettingsStore.setState({ minZoom: 0.1, maxZoom: 3 });

    const capturedRefs: (() => void)[] = [];

    function Harness({ zoom }: { zoom: number }) {
      const controller = useCanvasViewportController({
        autoFitRacks: [],
        setCanvasZoom: () => undefined,
        stageRef: stageRef as MutableRefObject<Konva.Stage | null>,
        viewMode: 'storage',
        zoom
      });
      useEffect(() => {
        capturedRefs.push(controller.commitInteractionsForExternalCamera);
      });
      const ref = controller.containerRef;
      return createElement('div', { ref });
    }

    const rendered = render(createElement(Harness, { zoom: 1 }));
    act(() => {
      rendered.rerender(createElement(Harness, { zoom: 1.5 }));
    });

    expect(capturedRefs.length).toBeGreaterThanOrEqual(2);
    // All captured refs must be the exact same stable function reference.
    const first = capturedRefs[0];
    for (const ref of capturedRefs) {
      expect(ref).toBe(first);
    }

    rendered.unmount();
    globalThis.ResizeObserver = originalResizeObserver;
  });
});
