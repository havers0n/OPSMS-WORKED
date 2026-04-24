import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_DIAGNOSTICS_STORAGE_KEY,
  DEFAULT_CANVAS_DIAGNOSTICS_FLAGS,
  getCanvasDiagnosticsFlags,
  recordCanvasComponentRender,
  recordCanvasCullingMetrics,
  recordCanvasCameraStoreUpdate,
  resetCanvasRenderPipelineDiagnostics,
  resetCanvasCullingMetrics
} from './canvas-diagnostics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canvas diagnostics flags', () => {
  it('defaults production cell culling on without a diagnostics override', () => {
    vi.stubGlobal('window', {});

    expect(getCanvasDiagnosticsFlags()).toEqual(
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS
    );
  });

  it('accepts the internal unculled rollback override', () => {
    vi.stubGlobal('window', {
      __WOS_CANVAS_PERF_DIAGNOSTICS__: {
        cells: 'unculled',
        enableProductionCellCulling: false
      }
    });

    expect(getCanvasDiagnosticsFlags()).toMatchObject({
      cells: 'unculled',
      enableProductionCellCulling: false
    });
  });

  it('reads the internal rollback override from session storage', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) =>
          key === CANVAS_DIAGNOSTICS_STORAGE_KEY
            ? JSON.stringify({
                cells: 'unculled',
                enableProductionCellCulling: false
              })
            : null
      }
    });

    expect(getCanvasDiagnosticsFlags()).toMatchObject({
      cells: 'unculled',
      enableProductionCellCulling: false
    });
  });
});

describe('canvas culling metrics', () => {
  it('aggregates the latest per-source cell totals', () => {
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn()
    });

    resetCanvasCullingMetrics();
    recordCanvasCullingMetrics('rack-1:face-a', {
      cellsTotal: 10,
      cellsRendered: 4
    });
    recordCanvasCullingMetrics('rack-2:face-a', {
      cellsTotal: 5,
      cellsRendered: 5
    });
    recordCanvasCullingMetrics('rack-1:face-a', {
      cellsTotal: 8,
      cellsRendered: 2
    });

    expect(window.__WOS_CANVAS_CULLING_METRICS__).toEqual({
      cellsTotal: 13,
      cellsRendered: 7,
      cellsCulled: 6,
      cullingRatio: 0.5385
    });
  });
});

describe('canvas render pipeline diagnostics', () => {
  it('does not create diagnostics globals from passive record calls', () => {
    vi.stubGlobal('window', {});

    recordCanvasCameraStoreUpdate('offset');
    recordCanvasComponentRender({
      component: 'EditorCanvas',
      snapshot: { offsetX: 1 },
      stateKeys: ['offsetX']
    });

    expect(window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__).toBeUndefined();
  });

  it('records camera updates and render causes only after reset enables it', () => {
    vi.stubGlobal('window', {});

    resetCanvasRenderPipelineDiagnostics();
    recordCanvasCameraStoreUpdate('offset');
    recordCanvasComponentRender({
      component: 'EditorCanvas',
      snapshot: { offsetX: 1 },
      stateKeys: ['offsetX']
    });
    recordCanvasComponentRender({
      component: 'EditorCanvas',
      snapshot: { offsetX: 2 },
      stateKeys: ['offsetX']
    });

    expect(window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__).toMatchObject({
      cameraStoreUpdates: 1,
      offsetUpdates: 1,
      components: {
        EditorCanvas: {
          renders: 2,
          causes: {
            stateUpdates: 1
          }
        }
      }
    });
  });
});
