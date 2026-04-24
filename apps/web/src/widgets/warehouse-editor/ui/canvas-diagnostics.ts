import { useEffect, useState } from 'react';

export type CanvasDiagnosticsFlags = {
  labels: 'normal' | 'off';
  hitTest: 'normal' | 'off';
  cells: 'normal' | 'off' | 'visible-only' | 'unculled';
  cellOverlays: 'normal' | 'surface-only';
  enableProductionCellCulling: boolean;
};

export const DEFAULT_CANVAS_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  enableProductionCellCulling: true
};

export const CANVAS_DIAGNOSTICS_EVENT = 'wos:canvas-perf-diagnostics-change';
export const CANVAS_CULLING_METRICS_EVENT = 'wos:canvas-culling-metrics-change';
export const CANVAS_DIAGNOSTICS_STORAGE_KEY = '__WOS_CANVAS_PERF_DIAGNOSTICS__';

export type CanvasCullingMetrics = {
  cellsTotal: number;
  cellsRendered: number;
  cellsCulled: number;
  cullingRatio: number;
};

type CanvasCullingMetricSource = {
  cellsTotal: number;
  cellsRendered: number;
};

declare global {
  interface Window {
    __WOS_CANVAS_PERF_DIAGNOSTICS__?: Partial<CanvasDiagnosticsFlags>;
    __WOS_CANVAS_CULLING_METRICS__?: CanvasCullingMetrics;
    __WOS_CANVAS_CULLING_METRIC_SOURCES__?: Record<
      string,
      CanvasCullingMetricSource
    >;
  }
}

function resolveOption<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function getCanvasDiagnosticsFlags(): CanvasDiagnosticsFlags {
  if (typeof window === 'undefined') {
    return DEFAULT_CANVAS_DIAGNOSTICS_FLAGS;
  }

  const raw =
    window.__WOS_CANVAS_PERF_DIAGNOSTICS__ ??
    readSessionStorageDiagnosticsFlags();
  if (!raw) {
    return DEFAULT_CANVAS_DIAGNOSTICS_FLAGS;
  }

  return {
    labels: resolveOption(
      raw.labels,
      ['normal', 'off'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.labels
    ),
    hitTest: resolveOption(
      raw.hitTest,
      ['normal', 'off'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.hitTest
    ),
    cells: resolveOption(
      raw.cells,
      ['normal', 'off', 'visible-only', 'unculled'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.cells
    ),
    cellOverlays: resolveOption(
      raw.cellOverlays,
      ['normal', 'surface-only'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.cellOverlays
    ),
    enableProductionCellCulling:
      typeof raw.enableProductionCellCulling === 'boolean'
        ? raw.enableProductionCellCulling
        : DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.enableProductionCellCulling
  };
}

function readSessionStorageDiagnosticsFlags():
  | Partial<CanvasDiagnosticsFlags>
  | undefined {
  try {
    const raw = window.sessionStorage.getItem(CANVAS_DIAGNOSTICS_STORAGE_KEY);
    return raw
      ? (JSON.parse(raw) as Partial<CanvasDiagnosticsFlags>)
      : undefined;
  } catch {
    return undefined;
  }
}

function summarizeCullingSources(
  sources: Record<string, CanvasCullingMetricSource>
): CanvasCullingMetrics {
  const cellsTotal = Object.values(sources).reduce(
    (sum, source) => sum + source.cellsTotal,
    0
  );
  const cellsRendered = Object.values(sources).reduce(
    (sum, source) => sum + source.cellsRendered,
    0
  );
  const cellsCulled = Math.max(0, cellsTotal - cellsRendered);

  return {
    cellsTotal,
    cellsRendered,
    cellsCulled,
    cullingRatio:
      cellsTotal > 0
        ? Math.round((cellsRendered / cellsTotal) * 10000) / 10000
        : 1
  };
}

export function resetCanvasCullingMetrics() {
  if (typeof window === 'undefined') return;

  window.__WOS_CANVAS_CULLING_METRIC_SOURCES__ = {};
  window.__WOS_CANVAS_CULLING_METRICS__ = summarizeCullingSources({});
  window.dispatchEvent(new Event(CANVAS_CULLING_METRICS_EVENT));
}

export function recordCanvasCullingMetrics(
  sourceId: string,
  metrics: Pick<CanvasCullingMetrics, 'cellsTotal' | 'cellsRendered'>
) {
  if (typeof window === 'undefined') return;

  const sources = window.__WOS_CANVAS_CULLING_METRIC_SOURCES__;
  if (!sources) return;

  sources[sourceId] = {
    cellsTotal: metrics.cellsTotal,
    cellsRendered: metrics.cellsRendered
  };
  window.__WOS_CANVAS_CULLING_METRICS__ = summarizeCullingSources(sources);
  window.dispatchEvent(new Event(CANVAS_CULLING_METRICS_EVENT));
}

export function useCanvasDiagnosticsFlags(): CanvasDiagnosticsFlags {
  const [flags, setFlags] = useState(getCanvasDiagnosticsFlags);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleChange = () => setFlags(getCanvasDiagnosticsFlags());
    window.addEventListener(CANVAS_DIAGNOSTICS_EVENT, handleChange);
    return () =>
      window.removeEventListener(CANVAS_DIAGNOSTICS_EVENT, handleChange);
  }, []);

  return flags;
}
