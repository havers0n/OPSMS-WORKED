import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_DIAGNOSTICS_STORAGE_KEY,
  DEFAULT_CANVAS_DIAGNOSTICS_FLAGS,
  getCanvasDiagnosticsFlags,
  recordCanvasCullingMetrics,
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
