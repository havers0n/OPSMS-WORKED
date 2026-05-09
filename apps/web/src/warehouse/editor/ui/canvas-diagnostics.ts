import { useEffect, useState } from 'react';
import {
  isCanvasRestoreRenderMode,
  type CanvasRenderMode
} from './canvas-render-mode';

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
  | 'RackCells'
  | 'SelectionOverlayLayer';

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

export type CanvasDiagnosticsPhase =
  | 'idle'
  | 'active-skeleton'
  | 'restore-base'
  | 'restore-overlays'
  | 'restore-labels'
  | 'settled-full';

export type CanvasDiagnosticsPhaseMarkKind =
  | 'active-start'
  | 'active-end'
  | 'restore-base'
  | 'restore-overlays'
  | 'restore-labels'
  | 'restore-complete'
  | 'settled';

export type CanvasDiagnosticsPhaseMark = {
  kind: CanvasDiagnosticsPhaseMarkKind;
  phase: CanvasDiagnosticsPhase;
  renderMode: CanvasRenderMode;
  timeMs: number;
};

export type CanvasRenderPipelineDiagnostics = {
  enabled: boolean;
  currentRenderMode: CanvasRenderMode;
  renderModeCounts: Record<CanvasRenderMode, number>;
  renderModeTransitionCounts: Record<string, number>;
  currentPhase: CanvasDiagnosticsPhase;
  phaseCounts: Record<CanvasDiagnosticsPhase, number>;
  phaseMarks: CanvasDiagnosticsPhaseMark[];
  cameraStoreUpdates: number;
  offsetUpdates: number;
  zoomCameraUpdates: number;
  zoomTransientUpdates: number;
  zoomDurableCommits: number;
  components: Record<CanvasRenderComponentName, CanvasRenderComponentMetrics>;
  konva: {
    layerDrawCalls: number;
    layerBatchDrawCalls: number;
    rackLayerNodeCount: number;
  };
  selectionOverlay: {
    affectedCellCount: number;
    highlightedCellCount: number;
    resolvedCount: number;
    unresolvedCount: number;
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
    currentRenderMode: 'full',
    renderModeCounts: {
      full: 0,
      'interaction-light': 0,
      'interaction-skeleton': 0,
      'restore-base': 0,
      'restore-overlays': 0,
      'restore-labels': 0
    },
    renderModeTransitionCounts: {},
    currentPhase: 'idle',
    phaseCounts: {
      idle: 0,
      'active-skeleton': 0,
      'restore-base': 0,
      'restore-overlays': 0,
      'restore-labels': 0,
      'settled-full': 0
    },
    phaseMarks: [],
    cameraStoreUpdates: 0,
    offsetUpdates: 0,
    zoomCameraUpdates: 0,
    zoomTransientUpdates: 0,
    zoomDurableCommits: 0,
    components: {
      EditorCanvas: createComponentMetrics(),
      RackLayer: createComponentMetrics(),
      RackCells: createComponentMetrics(),
      SelectionOverlayLayer: createComponentMetrics()
    },
    konva: {
      layerDrawCalls: 0,
      layerBatchDrawCalls: 0,
      rackLayerNodeCount: 0
    },
    selectionOverlay: {
      affectedCellCount: 0,
      highlightedCellCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0
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

export function recordCanvasZoomTransientUpdate() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.zoomTransientUpdates += 1;
}

export function recordCanvasZoomDurableCommit() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.zoomDurableCommits += 1;
}

export function recordCanvasRenderMode(renderMode: CanvasRenderMode) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  const previousRenderMode = diagnostics.currentRenderMode;
  if (previousRenderMode !== renderMode) {
    const transitionKey = `${previousRenderMode}->${renderMode}`;
    diagnostics.renderModeTransitionCounts[transitionKey] =
      (diagnostics.renderModeTransitionCounts[transitionKey] ?? 0) + 1;
    diagnostics.currentRenderMode = renderMode;

    if (renderMode === 'interaction-skeleton') {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'active-start');
    } else if (
      previousRenderMode === 'interaction-skeleton' &&
      renderMode === 'restore-base'
    ) {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'active-end');
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-base');
    } else if (
      previousRenderMode === 'interaction-skeleton' &&
      renderMode === 'full'
    ) {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'active-end');
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-complete');
    } else if (renderMode === 'restore-base') {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-base');
    } else if (renderMode === 'restore-overlays') {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-overlays');
    } else if (renderMode === 'restore-labels') {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-labels');
    } else if (
      renderMode === 'full' &&
      isCanvasRestoreRenderMode(previousRenderMode)
    ) {
      recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-complete');
    }
  } else {
    diagnostics.currentRenderMode = renderMode;
  }

  diagnostics.renderModeCounts[renderMode] += 1;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function phaseForMark(
  kind: CanvasDiagnosticsPhaseMarkKind
): CanvasDiagnosticsPhase {
  if (kind === 'active-start' || kind === 'active-end') {
    return 'active-skeleton';
  }
  if (kind === 'restore-base') {
    return 'restore-base';
  }
  if (kind === 'restore-overlays') {
    return 'restore-overlays';
  }
  if (kind === 'restore-labels') {
    return 'restore-labels';
  }
  return 'settled-full';
}

function recordCanvasDiagnosticsPhaseMark(
  diagnostics: CanvasRenderPipelineDiagnostics,
  kind: CanvasDiagnosticsPhaseMarkKind
) {
  const phase = phaseForMark(kind);
  diagnostics.currentPhase = phase;
  diagnostics.phaseCounts[phase] += 1;
  diagnostics.phaseMarks.push({
    kind,
    phase,
    renderMode: diagnostics.currentRenderMode,
    timeMs: nowMs()
  });
}

export function recordCanvasActiveInteractionStart() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  recordCanvasDiagnosticsPhaseMark(diagnostics, 'active-start');
}

export function recordCanvasActiveInteractionEnd() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  recordCanvasDiagnosticsPhaseMark(diagnostics, 'active-end');
}

export function recordCanvasFullRestoreStart() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-base');
}

export function recordCanvasFullRestoreComplete() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  recordCanvasDiagnosticsPhaseMark(diagnostics, 'restore-complete');
}

export function recordCanvasSettledFull() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  recordCanvasDiagnosticsPhaseMark(diagnostics, 'settled');
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

export function recordCanvasSelectionOverlayMetrics({
  affectedCellCount,
  highlightedCellCount = 0,
  resolved
}: {
  affectedCellCount: number;
  highlightedCellCount?: number;
  resolved: boolean;
}) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.selectionOverlay ??= {
    affectedCellCount: 0,
    highlightedCellCount: 0,
    resolvedCount: 0,
    unresolvedCount: 0
  };
  diagnostics.selectionOverlay.affectedCellCount = affectedCellCount;
  diagnostics.selectionOverlay.highlightedCellCount = highlightedCellCount;
  if (resolved) {
    diagnostics.selectionOverlay.resolvedCount += 1;
  } else {
    diagnostics.selectionOverlay.unresolvedCount += 1;
  }
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

  const metrics =
    diagnostics.components[component] ??
    (diagnostics.components[component] = createComponentMetrics());
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
