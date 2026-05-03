import { beforeEach, describe, expect, it } from 'vitest';
import {
  HARD_MAX_CANVAS_ZOOM,
  HARD_MIN_CANVAS_ZOOM,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM
} from '@/entities/layout-version/lib/canvas-geometry';
import {
  resetCanvasZoomSettingsStore,
  useCanvasZoomSettingsStore
} from './canvas-zoom-settings';

describe('canvas zoom settings store', () => {
  beforeEach(() => {
    resetCanvasZoomSettingsStore();
  });

  it('starts with the default canvas zoom bounds', () => {
    expect(useCanvasZoomSettingsStore.getState().minZoom).toBe(MIN_CANVAS_ZOOM);
    expect(useCanvasZoomSettingsStore.getState().maxZoom).toBe(MAX_CANVAS_ZOOM);
  });

  it('keeps custom bounds inside the hard safe range', () => {
    useCanvasZoomSettingsStore.getState().setZoomBounds({
      minZoom: 0,
      maxZoom: 10
    });

    expect(useCanvasZoomSettingsStore.getState().minZoom).toBe(HARD_MIN_CANVAS_ZOOM);
    expect(useCanvasZoomSettingsStore.getState().maxZoom).toBe(HARD_MAX_CANVAS_ZOOM);
  });

  it('keeps minimum and maximum zoom separated', () => {
    useCanvasZoomSettingsStore.getState().setMaxZoom(0.12);

    expect(useCanvasZoomSettingsStore.getState().maxZoom).toBeCloseTo(0.15);
    expect(useCanvasZoomSettingsStore.getState().minZoom).toBe(MIN_CANVAS_ZOOM);
  });
});

