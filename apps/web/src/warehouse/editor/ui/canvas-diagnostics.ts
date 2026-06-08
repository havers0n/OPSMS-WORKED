import { useEffect, useState } from 'react';
import {
  isCanvasRestoreRenderMode,
  type CanvasRenderMode
} from './canvas-render-mode';

export type CanvasDiagnosticsFlags = {
  labels: 'normal' | 'off';
  grid: 'normal' | 'off-during-pan';
  hitTest: 'normal' | 'off';
  cells: 'normal' | 'off' | 'visible-only' | 'unculled';
  cellOverlays: 'normal' | 'surface-only' | 'off';
  storageOccupancyOverlay?: 'on' | 'off' | 'summary-only';
  enableProductionCellCulling: boolean;
  rackLayerRenderer: 'layer' | 'fast-layer';
  rackBodyShell?: 'normal' | 'cached';
};

export const DEFAULT_CANVAS_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  grid: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  storageOccupancyOverlay: 'on',
  enableProductionCellCulling: true,
  rackLayerRenderer: 'layer',
  rackBodyShell: 'normal'
};

export const CANVAS_DIAGNOSTICS_EVENT = 'wos:canvas-perf-diagnostics-change';
export const CANVAS_CULLING_METRICS_EVENT = 'wos:canvas-culling-metrics-change';
export const CANVAS_DIAGNOSTICS_STORAGE_KEY = '__WOS_CANVAS_PERF_DIAGNOSTICS__';
const ROUTE_PREVIEW_APP_PHASE_MARK_PREFIX = 'wos:route-preview:';

export type CanvasRenderComponentName =
  | 'EditorCanvas'
  | 'CellStateOverlayLayer'
  | 'RackBody'
  | 'RackLayer'
  | 'RackCells'
  | 'SelectionOverlayLayer'
  | 'StorageNavigator'
  | 'StorageInspectorV2';

export type RackLayerChildName =
  | 'RackBody'
  | 'RackSections'
  | 'RackCells'
  | 'SelectionOverlayLayer'
  | 'InteractionRect';

export type RackLayerChildProfilerMetrics = {
  childName: RackLayerChildName;
  rackId?: string;
  renderCount: number;
  totalActualDurationMs: number;
  maxActualDurationMs: number;
  lastActualDurationMs: number;
  propChanges: Record<string, number>;
  refChanges: Record<string, number>;
};

export type RackLayerChildProfiling = {
  enabled: boolean;
  childMetrics: Record<string, RackLayerChildProfilerMetrics>;
};

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

/**
 * One entry per render of a tracked component, stored in chronological order.
 * Used to compare individual render snapshots (e.g. mount vs update#1).
 * Only populated when __WOS_RACK_LAYER_RENDER_EVENTS__ is initialised.
 */
export type CanvasRenderEvent = {
  renderIndex: number;
  snapshot: Record<string, unknown>;
  changedKeys: string[];
};

/**
 * Exposed on window.__WOS_RACK_LAYER_RENDER_EVENTS__ so tests and DevTools
 * snippets can inspect the per-render sequence for RackLayer.
 * Length is capped at RACK_LAYER_RENDER_HISTORY_LIMIT to avoid unbounded growth.
 */
export type RackLayerRenderEvents = {
  events: CanvasRenderEvent[];
};

export type CanvasForceRenderReason =
  | 'none'
  | 'selection'
  | 'locate'
  | 'workflow'
  | 'debug';

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
  mode: {
    active: 'view' | 'storage' | 'layout' | 'unknown';
    // Call-frequency counters: increments each time recordCanvasMode is called.
    // Not a unique-session or screen-entry counter.
    counts: Record<'view' | 'storage' | 'layout' | 'unknown', number>;
  };
  dataSizes: {
    rackCount: number;
    visibleRackCount: number;
    publishedCellsTotal: number;
    renderedCellsCount: number;
    occupiedCellsCount: number;
    runtimeCellsCount: number;
    navigatorVisibleCellCount: number;
  };
  timings: Record<
    string,
    {
      count: number;
      totalMs: number;
      maxMs: number;
      lastMs: number;
    }
  >;
  counters: Record<string, number>;
  konva: {
    layerDrawCalls: number;
    layerBatchDrawCalls: number;
    layerDrawCallsByName: Record<string, number>;
    layerBatchDrawCallsByName: Record<string, number>;
    layerNodeCountsByName: Record<string, number>;
    rackLayerNodeCount: number;
    cellStateOverlayLayerNodeCount: number;
  };
  selectionOverlay: {
    affectedCellCount: number;
    highlightedCellCount: number;
    resolvedCount: number;
    unresolvedCount: number;
  };
  forceRenderReasons: Record<CanvasForceRenderReason, number>;
  rackLayerSnapshot: {
    renderedRackCount: number;
    renderedCellCount: number;
    rackBodyNodeCount: number;
    rackCellNodeCount: number;
    runtimeVisualNodeCount: number;
    statusCounts: {
      reserved: number;
      pick_active: number;
      occupied: number;
      empty: number;
      exception: number;
      other: number;
    };
    visibleRackCount: number;
    effectiveLod: 0 | 1 | 2;
    hitTestEnabled: boolean;
    cacheEnabled: boolean;
    rackLayerMountCount: number;
    rackLayerUnmountCount: number;
    rackLayerDrawCount: number;
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
    __WOS_CANVAS_KONVA_STARTUP_AUTODRAW_GATE_ENABLED__?: boolean;
    __WOS_CANVAS_DISABLE_MANUAL_PAN_BATCH_DRAW__?: boolean;
    __WOS_CANVAS_KONVA_SOURCE__?: string | null;
    __WOS_CANVAS_DIAGNOSTIC_MARKS__?: Record<string, number>;
    __WOS_ROUTE_PREVIEW_APP_PHASE_MARKS__?: Record<string, number>;
    /** Per-render event log for RackLayer. Populated when the render pipeline
     *  diagnostics are enabled. Capped at RACK_LAYER_RENDER_HISTORY_LIMIT entries. */
    __WOS_RACK_LAYER_RENDER_EVENTS__?: RackLayerRenderEvents;
    /** Child-level profiler metrics for RackLayer subtrees. */
    __WOS_RACK_LAYER_CHILD_PROFILING__?: RackLayerChildProfiling;
    /** Per-render, per-face profiling entries for RackCells internal phases. */
    __WOS_RACK_CELLS_INTERNAL_PROFILING__?: RackCellsInternalProfiling;
    /** Memo comparator skip/render counts per FaceCells instance ("rackId:faceId"). */
    __WOS_FACE_CELLS_MEMO_STATS__?: FaceCellsMemoStats;
  }
}

/**
 * Returns the global object that holds WOS diagnostic properties.
 * Uses `window` in browser/jsdom, falls back to `globalThis` in node
 * (e.g. vitest unit-test runs without jsdom).
 */
function getGlobal(): Partial<Window> {
  return (typeof window !== 'undefined' ? window : globalThis) as unknown as Partial<Window>;
}

/**
 * Returns a stable integer ID for any object reference.
 * Two calls with the same reference return the same integer.
 * Two calls with different references return different integers.
 * Used to add reference-identity snapshot keys to component diagnostics
 * so that `changedKeys` shows when an array/Map/Set prop changed identity
 * even if its logical value (e.g. serialised IDs string) didn't change.
 */
const _refIdMap = new WeakMap<object, number>();
let _refIdCounter = 0;
export function refId(obj: object): number {
  let id = _refIdMap.get(obj);
  if (id === undefined) {
    id = ++_refIdCounter;
    _refIdMap.set(obj, id);
  }
  return id;
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
    grid: resolveOption(
      raw.grid,
      ['normal', 'off-during-pan'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.grid
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
    storageOccupancyOverlay: resolveOption(
      raw.storageOccupancyOverlay,
      ['on', 'off', 'summary-only'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.storageOccupancyOverlay ?? 'on'
    ),
    enableProductionCellCulling:
      typeof raw.enableProductionCellCulling === 'boolean'
        ? raw.enableProductionCellCulling
        : DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.enableProductionCellCulling,
    rackLayerRenderer: resolveOption(
      raw.rackLayerRenderer,
      ['layer', 'fast-layer'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.rackLayerRenderer
    ),
    rackBodyShell: resolveOption(
      raw.rackBodyShell,
      ['normal', 'cached'] as const,
      DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.rackBodyShell ?? 'normal'
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
  const aggregated = summarizeCullingSources(sources);
  window.__WOS_CANVAS_CULLING_METRICS__ = aggregated;
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (diagnostics) {
    diagnostics.dataSizes.renderedCellsCount = aggregated.cellsRendered;
  }
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
      CellStateOverlayLayer: createComponentMetrics(),
      RackBody: createComponentMetrics(),
      RackLayer: createComponentMetrics(),
      RackCells: createComponentMetrics(),
      SelectionOverlayLayer: createComponentMetrics(),
      StorageNavigator: createComponentMetrics(),
      StorageInspectorV2: createComponentMetrics()
    },
    mode: {
      active: 'unknown',
      counts: {
        view: 0,
        storage: 0,
        layout: 0,
        unknown: 0
      }
    },
    dataSizes: {
      rackCount: 0,
      visibleRackCount: 0,
      publishedCellsTotal: 0,
      renderedCellsCount: 0,
      occupiedCellsCount: 0,
      runtimeCellsCount: 0,
      navigatorVisibleCellCount: 0
    },
    timings: {},
    counters: {},
    konva: {
      layerDrawCalls: 0,
      layerBatchDrawCalls: 0,
      layerDrawCallsByName: {},
      layerBatchDrawCallsByName: {},
      layerNodeCountsByName: {},
      rackLayerNodeCount: 0,
      cellStateOverlayLayerNodeCount: 0
    },
    selectionOverlay: {
      affectedCellCount: 0,
      highlightedCellCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0
    },
    forceRenderReasons: {
      none: 0,
      selection: 0,
      locate: 0,
      workflow: 0,
      debug: 0
    },
    rackLayerSnapshot: {
      renderedRackCount: 0,
      renderedCellCount: 0,
      rackBodyNodeCount: 0,
      rackCellNodeCount: 0,
      runtimeVisualNodeCount: 0,
      statusCounts: {
        reserved: 0,
        pick_active: 0,
        occupied: 0,
        empty: 0,
        exception: 0,
        other: 0
      },
      visibleRackCount: 0,
      effectiveLod: 2,
      hitTestEnabled: false,
      cacheEnabled: false,
      rackLayerMountCount: 0,
      rackLayerUnmountCount: 0,
      rackLayerDrawCount: 0
    }
  };
}

function getActiveRenderPipelineDiagnostics(): CanvasRenderPipelineDiagnostics | null {
  const diagnostics = getGlobal().__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__;
  return diagnostics?.enabled ? diagnostics : null;
}

export function isCanvasRenderPipelineDiagnosticsEnabled() {
  return getActiveRenderPipelineDiagnostics() !== null;
}

export function resetCanvasRenderPipelineDiagnostics() {
  const g = getGlobal();
  g.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ =
    createCanvasRenderPipelineDiagnostics();
  g.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = {};
  g.__WOS_RACK_LAYER_RENDER_EVENTS__ = { events: [] };
  resetRackLayerChildProfiling();
  resetRackCellsInternalProfiling();
  resetFaceCellsMemoStats();
}

export function stopCanvasRenderPipelineDiagnostics() {
  const diagnostics = getGlobal().__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__;
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

export function recordCanvasKonvaLayerDraw(
  kind: 'draw' | 'batchDraw',
  layerName = 'unknown-layer'
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.konva.layerDrawCallsByName ??= {};
  diagnostics.konva.layerBatchDrawCallsByName ??= {};

  if (kind === 'draw') {
    diagnostics.konva.layerDrawCalls += 1;
    diagnostics.konva.layerDrawCallsByName[layerName] =
      (diagnostics.konva.layerDrawCallsByName[layerName] ?? 0) + 1;
  } else {
    diagnostics.konva.layerBatchDrawCalls += 1;
    diagnostics.konva.layerBatchDrawCallsByName[layerName] =
      (diagnostics.konva.layerBatchDrawCallsByName[layerName] ?? 0) + 1;
  }
}

export function recordCanvasMode(mode: 'view' | 'storage' | 'layout' | 'unknown') {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  // Call-frequency counter by mode. This captures instrumentation activity volume.
  diagnostics.mode.active = mode;
  diagnostics.mode.counts[mode] += 1;
}

export function recordCanvasDataSizes(
  sizes: Partial<CanvasRenderPipelineDiagnostics['dataSizes']>
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  diagnostics.dataSizes = { ...diagnostics.dataSizes, ...sizes };
}

export function recordCanvasTiming(name: string, durationMs: number) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics || !Number.isFinite(durationMs) || durationMs < 0) return;
  const previous = diagnostics.timings[name] ?? {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    lastMs: 0
  };
  previous.count += 1;
  previous.totalMs += durationMs;
  previous.maxMs = Math.max(previous.maxMs, durationMs);
  previous.lastMs = durationMs;
  diagnostics.timings[name] = previous;
}

export function recordCanvasCounter(name: string, delta = 1) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  diagnostics.counters[name] = (diagnostics.counters[name] ?? 0) + delta;
}

export function markCanvasTimingStart(name: string) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics || typeof window === 'undefined') return;
  window.__WOS_CANVAS_DIAGNOSTIC_MARKS__ ??= {};
  window.__WOS_CANVAS_DIAGNOSTIC_MARKS__[name] = nowMs();
}

export function markCanvasTimingEnd(name: string) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics || typeof window === 'undefined') return;
  const start = window.__WOS_CANVAS_DIAGNOSTIC_MARKS__?.[name];
  if (typeof start !== 'number') return;
  recordCanvasTiming(name, nowMs() - start);
  delete window.__WOS_CANVAS_DIAGNOSTIC_MARKS__?.[name];
}

export function recordRoutePreviewAppPhaseMark(
  name: string,
  options?: { onceKey?: string }
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics || typeof window === 'undefined') return;
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }

  const markName = `${ROUTE_PREVIEW_APP_PHASE_MARK_PREFIX}${name}`;
  const onceKey = options?.onceKey ?? markName;
  window.__WOS_ROUTE_PREVIEW_APP_PHASE_MARKS__ ??= {};
  if (window.__WOS_ROUTE_PREVIEW_APP_PHASE_MARKS__[onceKey]) return;
  window.__WOS_ROUTE_PREVIEW_APP_PHASE_MARKS__[onceKey] = nowMs();
  performance.mark(markName);
}

export function recordCanvasLayerNodeCount(
  layerName: string,
  nodeCount: number
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.konva.layerNodeCountsByName ??= {};
  diagnostics.konva.layerNodeCountsByName[layerName] = nodeCount;
  if (layerName === 'rack-base-layer') {
    diagnostics.konva.rackLayerNodeCount = nodeCount;
  }
  if (layerName === 'cell-state-overlay-layer') {
    diagnostics.konva.cellStateOverlayLayerNodeCount = nodeCount;
  }
}

export function recordCanvasRackLayerNodeCount(nodeCount: number) {
  recordCanvasLayerNodeCount('rack-base-layer', nodeCount);
}

export function recordCanvasRackLayerSnapshot(
  snapshot: Partial<CanvasRenderPipelineDiagnostics['rackLayerSnapshot']>
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  Object.assign(diagnostics.rackLayerSnapshot, snapshot);
}

export function recordCanvasRackLayerMount() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  diagnostics.rackLayerSnapshot.rackLayerMountCount += 1;
}

export function recordCanvasRackLayerUnmount() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  diagnostics.rackLayerSnapshot.rackLayerUnmountCount += 1;
}

export function recordCanvasRackLayerDraw() {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;
  diagnostics.rackLayerSnapshot.rackLayerDrawCount += 1;
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

export function recordCanvasForceRenderReasons(
  counts: Record<CanvasForceRenderReason, number>
) {
  const diagnostics = getActiveRenderPipelineDiagnostics();
  if (!diagnostics) return;

  diagnostics.forceRenderReasons = counts;
}

export function recordRackLayerChildProfiler({
  childName,
  rackId,
  actualDurationMs,
  changedProps = []
}: {
  childName: RackLayerChildName;
  rackId?: string;
  actualDurationMs: number;
  changedProps?: string[];
}) {
  if (!isCanvasRenderPipelineDiagnosticsEnabled()) return;

  const g = getGlobal();
  g.__WOS_RACK_LAYER_CHILD_PROFILING__ ??= {
    enabled: true,
    childMetrics: {}
  };

  const profiling = g.__WOS_RACK_LAYER_CHILD_PROFILING__;
  if (!profiling) return;

  const metricKey = rackId ? `${childName}:${rackId}` : childName;
  const metric = profiling.childMetrics[metricKey] ?? {
    childName,
    rackId,
    renderCount: 0,
    totalActualDurationMs: 0,
    maxActualDurationMs: 0,
    lastActualDurationMs: 0,
    propChanges: {},
    refChanges: {}
  };

  metric.renderCount += 1;
  metric.totalActualDurationMs += actualDurationMs;
  metric.maxActualDurationMs = Math.max(metric.maxActualDurationMs, actualDurationMs);
  metric.lastActualDurationMs = actualDurationMs;

  for (const prop of changedProps) {
    metric.propChanges[prop] = (metric.propChanges[prop] ?? 0) + 1;
  }

  profiling.childMetrics[metricKey] = metric;
}

export function resetRackLayerChildProfiling() {
  const g = getGlobal();
  g.__WOS_RACK_LAYER_CHILD_PROFILING__ = {
    enabled: true,
    childMetrics: {}
  };
}

export function getRackLayerChildProfilingReport(): {
  childMetrics: RackLayerChildProfilerMetrics[];
  summary: string;
} {
  const g = getGlobal();
  const profiling = g.__WOS_RACK_LAYER_CHILD_PROFILING__;
  if (!profiling || !profiling.enabled) {
    return {
      childMetrics: [],
      summary: 'RackLayer child profiling not enabled'
    };
  }

  const metrics = Object.values(profiling.childMetrics);
  if (metrics.length === 0) {
    return {
      childMetrics: [],
      summary: 'No child metrics recorded'
    };
  }

  // Sort by total duration descending to identify most expensive children
  const sorted = [...metrics].sort(
    (a, b) => b.totalActualDurationMs - a.totalActualDurationMs
  );

  let summary = '\n=== RackLayer Child Attribution Report ===\n';
  summary += `Total children tracked: ${metrics.length}\n`;
  summary += `Total time: ${sorted.reduce((sum, m) => sum + m.totalActualDurationMs, 0).toFixed(2)}ms\n\n`;

  // Aggregate per-child metrics (sum across all instances)
  const perChild: Record<string, { count: number; total: number; max: number; instances: number }> = {};
  for (const metric of metrics) {
    const key = metric.childName;
    const entry = perChild[key] ?? { count: 0, total: 0, max: 0, instances: 0 };
    entry.count += metric.renderCount;
    entry.total += metric.totalActualDurationMs;
    entry.max = Math.max(entry.max, metric.maxActualDurationMs);
    entry.instances += 1;
    perChild[key] = entry;
  }

  summary += '--- Per Child Type ---\n';
  const sortedPerChild = Object.entries(perChild).sort((a, b) => b[1].total - a[1].total);
  for (const [childName, stats] of sortedPerChild) {
    const avgDuration = stats.total / stats.count;
    summary += `${childName}:\n`;
    summary += `  Total renders: ${stats.count} (across ${stats.instances} instances)\n`;
    summary += `  Total duration: ${stats.total.toFixed(2)}ms\n`;
    summary += `  Max duration: ${stats.max.toFixed(2)}ms\n`;
    summary += `  Avg per render: ${avgDuration.toFixed(2)}ms\n`;
    summary += `  % of total: ${((stats.total / sorted.reduce((sum, m) => sum + m.totalActualDurationMs, 0)) * 100).toFixed(1)}%\n`;
    summary += '\n';
  }

  summary += '--- Per Instance ---\n';
  for (const metric of sorted.slice(0, 20)) {
    const avgDuration = metric.totalActualDurationMs / metric.renderCount;
    summary += `${metric.childName}${metric.rackId ? `:${metric.rackId}` : ''}:\n`;
    summary += `  Renders: ${metric.renderCount}\n`;
    summary += `  Total duration: ${metric.totalActualDurationMs.toFixed(2)}ms\n`;
    summary += `  Max duration: ${metric.maxActualDurationMs.toFixed(2)}ms\n`;
    summary += `  Avg: ${avgDuration.toFixed(2)}ms\n`;
    if (Object.keys(metric.propChanges).length > 0) {
      summary += `  Changed refs: ${Object.entries(metric.propChanges)
        .sort((a, b) => b[1] - a[1])
        .map(([prop, count]) => `${prop}(${count})`)
        .join(', ')}\n`;
    }
    summary += '\n';
  }

  return { childMetrics: sorted, summary };
}

// ---------------------------------------------------------------------------
// RackCells internal per-render, per-phase profiling
// ---------------------------------------------------------------------------

/**
 * One entry per FaceCells call that reaches the JSX render path (not early returns).
 * Populated when __WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ is enabled.
 */
export type RackCellsFaceRenderEntry = {
  rackId: string;
  faceId: string;
  renderIndex: number;
  triggerFlags: {
    publishedCellsByStructure_changed: boolean;
    occupiedCellIds_changed: boolean;
    cellRuntimeById_changed: boolean;
  };
  cellsGeometry: number;
  cellsRendered: number;
  labelsCount: number;
  geometryMs: number;
  loopMs: number;
  visualStateMs: number;
  lookupMs: number;
};

export type RackCellsInternalProfiling = {
  entries: RackCellsFaceRenderEntry[];
};

export function recordRackCellsFaceRender(entry: RackCellsFaceRenderEntry) {
  if (!isCanvasRenderPipelineDiagnosticsEnabled()) return;
  const g = getGlobal();
  g.__WOS_RACK_CELLS_INTERNAL_PROFILING__ ??= { entries: [] };
  g.__WOS_RACK_CELLS_INTERNAL_PROFILING__.entries.push(entry);
}

export function resetRackCellsInternalProfiling() {
  const g = getGlobal();
  g.__WOS_RACK_CELLS_INTERNAL_PROFILING__ = { entries: [] };
}

export function getRackCellsInternalProfilingReport(): {
  entries: RackCellsFaceRenderEntry[];
  summary: string;
} {
  const g = getGlobal();
  const profiling = g.__WOS_RACK_CELLS_INTERNAL_PROFILING__;
  if (!profiling || profiling.entries.length === 0) {
    return {
      entries: [],
      summary: 'No RackCells internal profiling data. Enable render pipeline diagnostics first.'
    };
  }

  const { entries } = profiling;
  const totalEntries = entries.length;

  // Aggregate per rackId
  const byRack = new Map<
    string,
    {
      faceEntries: RackCellsFaceRenderEntry[];
      maxRenderIndex: number;
    }
  >();
  for (const entry of entries) {
    let rack = byRack.get(entry.rackId);
    if (!rack) {
      rack = { faceEntries: [], maxRenderIndex: 0 };
      byRack.set(entry.rackId, rack);
    }
    rack.faceEntries.push(entry);
    if (entry.renderIndex > rack.maxRenderIndex) rack.maxRenderIndex = entry.renderIndex;
  }

  let summary = '\n=== RackCells Internal Phase Profiling Report ===\n';
  summary += `Total face renders recorded: ${totalEntries}\n\n`;

  for (const [rackId, { faceEntries, maxRenderIndex }] of byRack) {
    const totalGeometry = faceEntries.reduce((s, e) => s + e.geometryMs, 0);
    const totalLoop = faceEntries.reduce((s, e) => s + e.loopMs, 0);
    const totalVS = faceEntries.reduce((s, e) => s + e.visualStateMs, 0);
    const totalLookup = faceEntries.reduce((s, e) => s + e.lookupMs, 0);
    const totalPreRender = totalGeometry + totalLoop;
    const maxCells = Math.max(...faceEntries.map((e) => e.cellsGeometry));
    const maxRendered = Math.max(...faceEntries.map((e) => e.cellsRendered));
    const maxLabels = Math.max(...faceEntries.map((e) => e.labelsCount));

    summary += `Rack ${rackId}:\n`;
    summary += `  Component renders: ${maxRenderIndex}, face render entries: ${faceEntries.length}\n`;
    summary += `  Max cells in geometry: ${maxCells}, max rendered (post-cull): ${maxRendered}, max labels: ${maxLabels}\n`;
    summary += `  Pre-render total: ${totalPreRender.toFixed(2)}ms\n`;
    summary += `    geometry phase: ${totalGeometry.toFixed(2)}ms (${totalPreRender > 0 ? ((totalGeometry / totalPreRender) * 100).toFixed(0) : 0}%)\n`;
    summary += `    loop phase:     ${totalLoop.toFixed(2)}ms (${totalPreRender > 0 ? ((totalLoop / totalPreRender) * 100).toFixed(0) : 0}%)\n`;
    if (totalLoop > 0) {
      const otherLoop = totalLoop - totalVS - totalLookup;
      summary += `      └─ visual-state: ${totalVS.toFixed(2)}ms (${((totalVS / totalLoop) * 100).toFixed(0)}%)\n`;
      summary += `      └─ lookups:      ${totalLookup.toFixed(2)}ms (${((totalLookup / totalLoop) * 100).toFixed(0)}%)\n`;
      summary += `      └─ other (cull+build): ${otherLoop.toFixed(2)}ms (${((otherLoop / totalLoop) * 100).toFixed(0)}%)\n`;
    }

    // Trigger breakdown
    const triggerGroups = new Map<string, number>();
    for (const e of faceEntries) {
      const key = [
        e.triggerFlags.publishedCellsByStructure_changed && 'struct',
        e.triggerFlags.occupiedCellIds_changed && 'occupied',
        e.triggerFlags.cellRuntimeById_changed && 'runtime',
      ].filter(Boolean).join('+') || 'none/mount';
      triggerGroups.set(key, (triggerGroups.get(key) ?? 0) + 1);
    }
    summary += `  Triggers: ${[...triggerGroups.entries()].map(([k, v]) => `${k}(${v})`).join(', ')}\n`;
    summary += '\n';
  }

  // Key questions
  summary += '--- Key Questions ---\n';

  const occupiedOnlyEntries = entries.filter(
    (e) =>
      e.triggerFlags.occupiedCellIds_changed &&
      !e.triggerFlags.publishedCellsByStructure_changed &&
      !e.triggerFlags.cellRuntimeById_changed
  );
  const runtimeOnlyEntries = entries.filter(
    (e) =>
      e.triggerFlags.cellRuntimeById_changed &&
      !e.triggerFlags.publishedCellsByStructure_changed &&
      !e.triggerFlags.occupiedCellIds_changed
  );
  const allWithLabels = entries.filter((e) => e.labelsCount > 0);

  if (occupiedOnlyEntries.length > 0) {
    const avgGeometry =
      occupiedOnlyEntries.reduce((s, e) => s + e.geometryMs, 0) / occupiedOnlyEntries.length;
    const avgLoop =
      occupiedOnlyEntries.reduce((s, e) => s + e.loopMs, 0) / occupiedOnlyEntries.length;
    summary += `occupiedCellIds-only renders (${occupiedOnlyEntries.length} face renders):\n`;
    summary += `  → collectRenderedFaceCellGeometries re-runs: YES (avg ${avgGeometry.toFixed(2)}ms — wasted static work)\n`;
    summary += `  → resolveCellVisualState re-runs: YES (avg loop ${avgLoop.toFixed(2)}ms)\n`;
  }
  if (runtimeOnlyEntries.length > 0) {
    const avgGeometry =
      runtimeOnlyEntries.reduce((s, e) => s + e.geometryMs, 0) / runtimeOnlyEntries.length;
    summary += `cellRuntimeById-only renders (${runtimeOnlyEntries.length} face renders):\n`;
    summary += `  → collectRenderedFaceCellGeometries re-runs: YES (avg ${avgGeometry.toFixed(2)}ms — wasted static work)\n`;
  }

  summary += `Labels: ${allWithLabels.length} of ${totalEntries} face renders had visible address labels\n`;

  // Dominant phase across all entries
  const grandGeometry = entries.reduce((s, e) => s + e.geometryMs, 0);
  const grandLoop = entries.reduce((s, e) => s + e.loopMs, 0);
  const grandVS = entries.reduce((s, e) => s + e.visualStateMs, 0);
  const grandLookup = entries.reduce((s, e) => s + e.lookupMs, 0);
  const grandPreRender = grandGeometry + grandLoop;
  summary += `\nGlobal pre-render breakdown (all racks, all renders):\n`;
  summary += `  geometry: ${grandGeometry.toFixed(2)}ms, loop: ${grandLoop.toFixed(2)}ms\n`;
  summary += `  visual-state: ${grandVS.toFixed(2)}ms, lookups: ${grandLookup.toFixed(2)}ms\n`;
  summary += `  Total pre-render JS: ${grandPreRender.toFixed(2)}ms\n`;
  summary += `  (Remainder = React/Konva JSX reconciliation, not measured here)\n`;

  return { entries, summary };
}

// ---------------------------------------------------------------------------
// FaceCells memo comparator stats
// ---------------------------------------------------------------------------

export type FaceCellsMemoStats = {
  /** Incremented when comparator returns true (render skipped). Key = "rackId:faceId". */
  skips: Record<string, number>;
  /** Incremented when comparator returns false (render proceeds). Key = "rackId:faceId". */
  renders: Record<string, number>;
  /** Total comparator invocations (skips + renders). */
  comparatorCalls: number;
};

export function recordFaceCellsMemoSkip(key: string) {
  const g = getGlobal();
  const s = g.__WOS_FACE_CELLS_MEMO_STATS__;
  if (!s) return;
  s.comparatorCalls += 1;
  s.skips[key] = (s.skips[key] ?? 0) + 1;
}

export function recordFaceCellsMemoRender(key: string) {
  const g = getGlobal();
  const s = g.__WOS_FACE_CELLS_MEMO_STATS__;
  if (!s) return;
  s.comparatorCalls += 1;
  s.renders[key] = (s.renders[key] ?? 0) + 1;
}

export function resetFaceCellsMemoStats() {
  const g = getGlobal();
  g.__WOS_FACE_CELLS_MEMO_STATS__ = { skips: {}, renders: {}, comparatorCalls: 0 };
}

export function getFaceCellsMemoStatsReport(): { stats: FaceCellsMemoStats; summary: string } {
  const g = getGlobal();
  const stats = g.__WOS_FACE_CELLS_MEMO_STATS__;
  if (!stats) {
    return {
      stats: { skips: {}, renders: {}, comparatorCalls: 0 },
      summary: 'FaceCells memo stats not initialised (set __WOS_FACE_CELLS_MEMO_STATS__ before startup)'
    };
  }

  const totalSkips = Object.values(stats.skips).reduce((s, n) => s + n, 0);
  const totalRenders = Object.values(stats.renders).reduce((s, n) => s + n, 0);
  const skipPct = stats.comparatorCalls > 0
    ? ((totalSkips / stats.comparatorCalls) * 100).toFixed(1)
    : 'N/A';

  let summary = '\n=== FaceCells Memo Comparator Stats ===\n';
  summary += `Comparator calls: ${stats.comparatorCalls}\n`;
  summary += `Skipped (returned true):  ${totalSkips} (${skipPct}%)\n`;
  summary += `Rendered (returned false): ${totalRenders}\n\n`;

  const entries = [
    ...Object.entries(stats.skips).map(([k, n]) => ({ key: k, skips: n, renders: stats.renders[k] ?? 0 })),
    ...Object.keys(stats.renders)
      .filter(k => !(k in stats.skips))
      .map(k => ({ key: k, skips: 0, renders: stats.renders[k] }))
  ].sort((a, b) => (b.skips + b.renders) - (a.skips + a.renders));

  if (entries.length > 0) {
    summary += '--- Per Face ---\n';
    for (const { key, skips, renders } of entries) {
      summary += `  ${key.slice(0, 20)}: skip=${skips} render=${renders}\n`;
    }
  }
  return { stats, summary };
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
  const g = getGlobal();
  const prevSnapshots =
    g.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ ?? {};
  g.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = prevSnapshots;
  const prev = prevSnapshots[snapshotKey];

  metrics.renders += 1;

  const changedKeysForRender: string[] = [];

  if (prev) {
    const changedKeys = Object.keys(snapshot).filter(
      (key) => !Object.is(snapshot[key], prev[key])
    );
    for (const key of changedKeys) {
      metrics.changedKeys[key] = (metrics.changedKeys[key] ?? 0) + 1;
      changedKeysForRender.push(key);
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

  if (component === 'RackLayer') {
    const store = getGlobal().__WOS_RACK_LAYER_RENDER_EVENTS__;
    if (store) {
      store.events.push({
        renderIndex: metrics.renders,
        snapshot,
        changedKeys: changedKeysForRender
      });
    }
  }
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
