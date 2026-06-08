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
      disableOccupancyOverlay: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
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

  it('requires debug=1 for disableRackBodyShadows', () => {
    expect(
      resolveStorageDebugFlags('?disableRackBodyShadows=1')
    ).toMatchObject({
      disableRackBodyShadows: false
    });
    expect(
      resolveStorageDebugFlags('?debug=1&disableRackBodyShadows=1')
    ).toMatchObject({
      disableRackBodyShadows: true
    });
  });

  it('requires debug=1 for simpleRackBodyShell', () => {
    expect(
      resolveStorageDebugFlags('?simpleRackBodyShell=1')
    ).toMatchObject({
      simpleRackBodyShell: false
    });
    expect(
      resolveStorageDebugFlags('?debug=1&simpleRackBodyShell=1')
    ).toMatchObject({
      simpleRackBodyShell: true
    });
  });

  it('requires debug=1 for disableRackBodyLabels', () => {
    expect(
      resolveStorageDebugFlags('?disableRackBodyLabels=1')
    ).toMatchObject({
      disableRackBodyLabels: false
    });
    expect(
      resolveStorageDebugFlags('?debug=1&disableRackBodyLabels=1')
    ).toMatchObject({
      disableRackBodyLabels: true
    });
  });

  it('requires debug=1 for disableRackBodyStrokes', () => {
    expect(
      resolveStorageDebugFlags('?disableRackBodyStrokes=1')
    ).toMatchObject({
      disableRackBodyStrokes: false
    });
    expect(
      resolveStorageDebugFlags('?debug=1&disableRackBodyStrokes=1')
    ).toMatchObject({
      disableRackBodyStrokes: true
    });
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
