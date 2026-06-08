// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getClientRuntimeDiagnosticsSnapshot,
  installGlobalClientRuntimeDiagnostics,
  recordClientRuntimeCanvasSnapshot,
  reportClientRuntimeError,
  setClientRuntimeRoute
} from './client-runtime-diagnostics';

describe('client runtime diagnostics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    setClientRuntimeRoute('/warehouse/view?debug=1');
  });

  it('stores and posts reported runtime errors', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 202 })
    );

    const errorId = reportClientRuntimeError({
      source: 'manual-debug',
      message: 'Storage view crashed',
      context: {
        stage: 'test'
      }
    });

    expect(errorId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(getClientRuntimeDiagnosticsSnapshot().lastError).toMatchObject({
      clientErrorId: errorId,
      route: '/warehouse/view?debug=1',
      message: 'Storage view crashed'
    });

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/client-errors',
      expect.objectContaining({
        method: 'POST',
        keepalive: true
      })
    );
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    ).toMatchObject({
      kind: 'error',
      error: {
        clientErrorId: errorId,
        route: '/warehouse/view?debug=1',
        message: 'Storage view crashed'
      }
    });
  });

  it('stores and posts canvas lifecycle snapshots', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 202 })
    );

    recordClientRuntimeCanvasSnapshot({
      sessionId: 'session-1',
      timestamp: '2026-06-08T09:00:00.000Z',
      activeWarehouseMode: 'storage',
      snapshotReason: 'after-entering-storage-mode',
      canvasCount: 1,
      canvasElements: [
        {
          width: 390,
          height: 699,
          clientWidth: 390,
          clientHeight: 699,
          approximateMiB: 1.04
        }
      ],
      totalApproxCanvasMiB: 1.04,
      konvaStageCount: 1,
      konvaLayerCount: 4,
      stageMountCount: 1,
      stageDestroyCount: 0,
      currentIsolationFlags: {
        disableStorageWorkspace: false,
        disableStorageCanvas: false,
        forceKonvaPixelRatio1: true
      },
      effectiveKonvaPixelRatio: 1,
      viewport: {
        width: 390,
        height: 699
      },
      devicePixelRatio: 3,
      dimensionPipeline: {
        containerClientWidth: 390,
        containerClientHeight: 699,
        viewportWidth: 390,
        viewportHeight: 699,
        stageWidth: 390,
        stageHeight: 699,
        primaryCanvasWidth: 390,
        primaryCanvasHeight: 699,
        primaryCanvasClientWidth: 390,
        primaryCanvasClientHeight: 699,
        dprApplication: 'once'
      }
    });

    expect(
      getClientRuntimeDiagnosticsSnapshot().recentCanvasSnapshots[0]
    ).toMatchObject({
      sessionId: 'session-1',
      snapshotReason: 'after-entering-storage-mode'
    });

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/client-errors',
      expect.objectContaining({
        method: 'POST',
        keepalive: true
      })
    );
    expect(
      JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    ).toMatchObject({
      kind: 'canvas-lifecycle-snapshot',
      snapshot: {
        sessionId: 'session-1',
        snapshotReason: 'after-entering-storage-mode'
      }
    });
  });

  it('installs global error listeners that capture window errors', () => {
    const cleanup = installGlobalClientRuntimeDiagnostics();

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'phone crash',
        error: new Error('phone crash')
      })
    );

    expect(getClientRuntimeDiagnosticsSnapshot().lastError).toMatchObject({
      source: 'window-error',
      message: 'phone crash'
    });

    cleanup();
  });
});
