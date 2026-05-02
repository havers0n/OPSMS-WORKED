import { useEffect, useState } from 'react';

export type CanvasDiagnosticsFlags = {
  labels: 'normal' | 'off';
  hitTest: 'normal' | 'off';
  cells: 'normal' | 'off' | 'visible-only' | 'unculled';
  cellOverlays: 'normal' | 'surface-only' | 'off';
  enableProductionCellCulling: boolean;
  rackLayerRenderer: 'layer' | 'fast-layer';
};

export const DEFAULT_CANVAS_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  enableProductionCellCulling: true,
  rackLayerRenderer: 'layer'
};

export const CANVAS_DIAGNOSTICS_EVENT = 'wos:canvas-perf-diagnostics-change';
export const CANVAS_CULLING_METRICS_EVENT = 'wos:canvas-culling-metrics-change';
export const CANVAS_DIAGNOSTICS_STORAGE_KEY = '__WOS_CANVAS_PERF_DIAGNOSTICS__';

export type CanvasRenderComponentName =
  | 'EditorCanvas'
  | 'RackLayer'
  | 'RackCells';

export type CanvasRenderCauseCounts = {
  stateUpdates: number;
  propsChanges: number;
  parentRerenders: number;
};

export type CanvasRenderComponentMetrics = {
  renders: number;
  causes: CanvasRenderCauseCounts;
  changedKeys: Record<string, number>;
};

export type CanvasRenderPipelineDiagnostics = {
  enabled: boolean;
  cameraStoreUpdates: number;
  offsetUpdates: number;
  zoomCameraUpdates: number;
  components: Record<CanvasRenderComponentName, CanvasRenderComponentMetrics>;
  konva: {
    layerDrawCalls: number;
    layerBatchDrawCalls: number;
    rackLayerNodeCount: number;
  };
};

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
    __WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__?: CanvasRenderPipelineDiagnostics;
    __WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__?: Record<
      string,
      Record<string, unknown>
    >;
    __WOS_CANVAS_STAGE__?: import('konva').default.Stage | null;
    __WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__?: boolean;
    __WOS_CANVAS_DISABLE_MANUAL_PAN_BATCH_DRAW__?: boolean;
    __WOS_CANVAS_KONVA_SOURCE__?: string | null;
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
      ['normal', 'surface-only', 'off'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.cellOverlays
    ),
    enableProductionCellCulling:
      typeof raw.enableProductionCellCulling === 'boolean'
        ? raw.enableProductionCellCulling
        : DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.enableProductionCellCulling,
    rackLayerRenderer: resolveOption(
      raw.rackLayerRenderer,
      ['layer', 'fast-layer'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.rackLayerRenderer
    )
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

function createComponentMetrics(): CanvasRenderComponentMetrics {
  return {
    renders: 0,
    causes: {
      stateUpdates: 0,
      propsChanges: 0,
      parentRerenders: 0
    },
    changedKeys: {}
  };
}

export function createCanvasRenderPipelineDiagnostics(): CanvasRenderPipelineDiagnostics {
  return {
    enabled: true,
    cameraStoreUpdates: 0,
    offsetUpdates: 0,
    zoomCameraUpdates: 0,
    components: {
      EditorCanvas: createComponentMetrics(),
      RackLayer: createComponentMetrics(),
      RackCells: createComponentMetrics()
    },
    konva: {
      layerDrawCalls: 0,
      layerBatchDrawCalls: 0,
      rackLayerNodeCount: 0
    }
  };
}

function getActiveRenderPipelineDiagnostics():
  | CanvasRenderPipelineDiagnostics
  | null {
  if (typeof window === 'undefined') return null;
  const diagnostics = window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__;
  return diagnostics?.enabled ? diagnostics : null;
}

export function resetCanvasRenderPipelineDiagnostics() {
  if (typeof window === 'undefined') return;

  window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ =
    createCanvasRenderPipelineDiagnostics();
  window.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = {};
}

export function stopCanvasRenderPipelineDiagnostics() {
  if (typeof window === 'undefined') return;
  const diagnostics = window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__;
  if (diagnostics) {
    diagnostics.enabled = false;
  }
}

export function recordCanvasCameraStoreUpdate(kind: 'offset' | 'camera') {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.cameraStoreUpdates += 1;
  if (kind === 'offset') {
    diagnostics.offsetUpdates += 1;
  } else {
    diagnostics.zoomCameraUpdates += 1;
  }
}

export function recordCanvasKonvaLayerDraw(kind: 'draw' | 'batchDraw') {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  if (kind === 'draw') {
    diagnostics.konva.layerDrawCalls += 1;
  } else {
    diagnostics.konva.layerBatchDrawCalls += 1;
  }
}

export function recordCanvasRackLayerNodeCount(nodeCount: number) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.konva.rackLayerNodeCount = nodeCount;
}

export function recordCanvasComponentRender({
  component,
  instanceId = 'default',
  propsKeys = [],
  snapshot,
  stateKeys = []
}: {
  component: CanvasRenderComponentName;
  instanceId?: string;
  snapshot: Record<string, unknown>;
  stateKeys?: string[];
  propsKeys?: string[];
}) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  const metrics = diagnostics.components[component];
  const snapshotKey = `${component}:${instanceId}`;
  const prevSnapshots =
    window.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ ?? {};
  window.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = prevSnapshots;
  const prev = prevSnapshots[snapshotKey];

  metrics.renders += 1;

  if (prev) {
    const changedKeys = Object.keys(snapshot).filter(
      (key) => !Object.is(snapshot[key], prev[key])
    );
    for (const key of changedKeys) {
      metrics.changedKeys[key] = (metrics.changedKeys[key] ?? 0) + 1;
    }

    const changedState = changedKeys.some((key) => stateKeys.includes(key));
    const changedProps = changedKeys.some((key) => propsKeys.includes(key));
    if (changedState) {
      metrics.causes.stateUpdates += 1;
    } else if (changedProps) {
      metrics.causes.propsChanges += 1;
    } else {
      metrics.causes.parentRerenders += 1;
    }
  }

  prevSnapshots[snapshotKey] = snapshot;
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
