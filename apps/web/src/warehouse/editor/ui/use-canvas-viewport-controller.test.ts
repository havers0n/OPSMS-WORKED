import type Konva from 'konva';
import { describe, expect, it, vi } from 'vitest';
import { LOD_CELL_ENTRY } from '@/entities/layout-version/lib/canvas-geometry';
import {
  batchDrawStageLayers,
  createTransformOnlyZoomState,
  createTransformOnlyPanState,
  finishTransformOnlyPan,
  finishTransformOnlyZoom,
  getModeEntryMinZoom,
  isStageCameraOffsetSynced,
  moveTransformOnlyPan,
  startTransformOnlyPan,
  updateTransformOnlyZoom
} from './use-canvas-viewport-controller';

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
