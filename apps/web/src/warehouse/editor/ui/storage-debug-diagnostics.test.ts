// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getClientRuntimeDiagnosticsSnapshot,
  setClientRuntimeRoute
} from '@/shared/diagnostics/client-runtime-diagnostics';
import {
  recordStorageDebugCanvasSnapshot,
  registerStorageDebugStage,
  setStorageDebugEffectiveKonvaPixelRatio,
  setStorageDebugViewportSnapshot,
  unregisterStorageDebugStage
} from './storage-debug-diagnostics';
import { resolveStorageDebugFlags } from './storage-debug-flags';

describe('storage debug diagnostics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.restoreAllMocks();
    setClientRuntimeRoute('/warehouse/view?debug=1');
  });

  it('captures DOM canvas dimensions and approximate MiB', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 699, configurable: true });
    canvas.width = 780;
    canvas.height = 1398;
    document.body.appendChild(canvas);

    const stage = {
      width: () => 390,
      height: () => 699,
      getLayers: () => [{}, {}, {}, {}]
    };

    registerStorageDebugStage(stage as never);
    setStorageDebugEffectiveKonvaPixelRatio(2);
    setStorageDebugViewportSnapshot({
      viewport: { width: 390, height: 699 },
      containerClientSize: { width: 390, height: 699 }
    });

    recordStorageDebugCanvasSnapshot({
      activeWarehouseMode: 'storage',
      snapshotReason: 'after-entering-storage-mode',
      currentIsolationFlags: resolveStorageDebugFlags('?debug=1')
    });

    unregisterStorageDebugStage(stage as never);

    expect(
      getClientRuntimeDiagnosticsSnapshot().recentCanvasSnapshots[0]
    ).toMatchObject({
      canvasCount: 1,
      canvasElements: [
        expect.objectContaining({
          width: 780,
          height: 1398,
          clientWidth: 390,
          clientHeight: 699
        })
      ],
      totalApproxCanvasMiB: 4.16,
      konvaStageCount: 1,
      konvaLayerCount: 4,
      effectiveKonvaPixelRatio: 2,
      dimensionPipeline: expect.objectContaining({
        containerClientWidth: 390,
        viewportWidth: 390,
        stageWidth: 390,
        primaryCanvasWidth: 780,
        dprApplication: 'once'
      })
    });
  });
});
