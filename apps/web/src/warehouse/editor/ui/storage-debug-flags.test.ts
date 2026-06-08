import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveKonvaPixelRatio,
  resolveStorageDebugFlags
} from './storage-debug-flags';

describe('storage debug flags', () => {
  it('keeps production defaults unchanged without debug flags', () => {
    expect(resolveStorageDebugFlags('')).toEqual({
      debugEnabled: false,
      disableStorageWorkspace: false,
      disableStorageCanvas: false,
      disableRackLayer: false,
      disableRackCells: false,
      disableRackRuntimeVisuals: false,
      disableRackBodies: false,
      disableCanvasSceneData: false,
      forceKonvaPixelRatio1: false,
      disableStorageData: false,
      disableInspector: false,
      disableNavigator: false,
      disableOccupancyOverlay: false
    });

    expect(
      resolveEffectiveKonvaPixelRatio({
        devicePixelRatio: 3,
        flags: { forceKonvaPixelRatio1: false }
      })
    ).toBe(3);
  });

  it('only forces pixel ratio 1 for the explicit debug path', () => {
    expect(
      resolveStorageDebugFlags('?debug=1&forceKonvaPixelRatio1=1')
        .forceKonvaPixelRatio1
    ).toBe(true);
    expect(
      resolveEffectiveKonvaPixelRatio({
        devicePixelRatio: 3,
        flags: { forceKonvaPixelRatio1: true }
      })
    ).toBe(1);
  });

  it('keeps the new canvas isolation flags debug-only', () => {
    expect(
      resolveStorageDebugFlags('?disableRackLayer=1&disableCanvasSceneData=1')
    ).toMatchObject({
      disableRackLayer: false,
      disableCanvasSceneData: false
    });
    expect(
      resolveStorageDebugFlags(
        '?debug=1&disableRackLayer=1&disableCanvasSceneData=1'
      )
    ).toMatchObject({
      disableRackLayer: true,
      disableCanvasSceneData: true
    });
  });
});
