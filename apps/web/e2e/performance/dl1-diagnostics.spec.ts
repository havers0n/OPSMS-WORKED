import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { signInToWarehouse } from '../support/auth';
import {
  buildDemoWarehouseRackPayloads,
  demoWarehouseExpectedPreviewCellCount
} from '../support/demo-warehouse-layout';
import {
  resetWarehouseData,
  seedExplicitDraftScenario
} from '../support/local-supabase';

const SAMPLE_DURATION_MS = Number(
  process.env.DL1_DIAGNOSTICS_DURATION_MS ??
    process.env.DL1_PERF_DURATION_MS ??
    2000
);
const INCLUDE_LOW_END_PROFILE =
  process.env.DL1_DIAGNOSTICS_INCLUDE_LOW_END === '1';
const DIAGNOSTICS_STORAGE_KEY = '__WOS_CANVAS_PERF_DIAGNOSTICS__';
const DIAGNOSTICS_EVENT = 'wos:canvas-perf-diagnostics-change';

type DeviceProfile = {
  name: 'native-desktop' | 'weak-laptop-cpu-4x' | 'low-end-cpu-6x';
  cpuThrottleRate: number;
  viewport: {
    width: number;
    height: number;
  };
};

type DiagnosticsFlags = {
  labels: 'normal' | 'off';
  hitTest: 'normal' | 'off';
  cells: 'normal' | 'off' | 'visible-only' | 'unculled';
  cellOverlays: 'normal' | 'surface-only' | 'off';
  enableProductionCellCulling: boolean;
  rackLayerRenderer: 'layer' | 'fast-layer';
};

type VariantRuntimeOptions = {
  disableManualPanBatchDraw?: boolean;
  rackLayerListeningOffDuringPan?: boolean;
  disableRackLayerHitGraph?: boolean;
};

type Variant = {
  name: string;
  flags: DiagnosticsFlags | null;
  runtimeOptions?: VariantRuntimeOptions;
};

type ScenarioName =
  | 'pan'
  | 'zoom'
  | 'select'
  | 'hover'
  | 'load'
  | 'route-preview';

type RawProbeResult = {
  frameTimes: number[];
  longTasks: Array<{ duration: number; startTime: number; name: string }>;
  memory: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  } | null;
};

type RenderCauseCounts = {
  stateUpdates: number;
  propsChanges: number;
  parentRerenders: number;
};

type RenderComponentMetrics = {
  renders: number;
  causes: RenderCauseCounts;
  changedKeys: Record<string, number>;
};

type RenderPipelineDiagnostics = {
  enabled: boolean;
  cameraStoreUpdates: number;
  offsetUpdates: number;
  zoomCameraUpdates: number;
  components: {
    EditorCanvas: RenderComponentMetrics;
    RackLayer: RenderComponentMetrics;
    RackCells: RenderComponentMetrics;
  };
  konva: {
    layerDrawCalls: number;
    layerBatchDrawCalls: number;
    rackLayerNodeCount: number;
  };
};

type KonvaCallEvent = {
  index: number;
  traceId: number | null;
  name: string;
  source: string;
  timeMs: number;
  layerName?: string;
  nodeType?: string;
  detail?: string;
};

type KonvaTrace = {
  traceId: number;
  events: KonvaCallEvent[];
};

type KonvaLayerScopeMetrics = {
  name: string;
  nodeType: string;
  batchDrawCalls: number;
  drawCalls: number;
  drawSceneCalls: number;
  drawHitCalls: number;
  getIntersectionCalls: number;
  listening: boolean;
};

type RackLayerNodeComposition = {
  total: number;
  byType: Record<string, number>;
  listeningTrue: number;
  hitGraphEligible: number;
};

type KonvaNodeDrawCost = {
  calls: number;
  totalMs: number;
  p95Ms: number;
  maxMs: number;
};

type KonvaRectRoleStyleCounters = {
  nodes: number;
  fillEnabled: number;
  strokeEnabled: number;
  opacityLt1: number;
  shadowEnabled: number;
  dashEnabled: number;
  listeningTrue: number;
  hitGraphEligible: number;
  strokeWidths: Record<string, number>;
};

type KonvaPipelineProbeResult = {
  autoDrawEnabled: boolean | null;
  stageAutoDrawAttr: unknown;
  stageBatchDrawCalls: number;
  stagePositionCalls: number;
  nodeRequestDrawCalls: number;
  layerBatchDrawCalls: number;
  layerDrawCalls: number;
  drawSceneCalls: number;
  drawHitCalls: number;
  drawSceneTotalMs: number;
  drawHitTotalMs: number;
  nodeSceneDrawCostByType: Record<string, KonvaNodeDrawCost>;
  nodeSceneDrawCostBuckets: Record<string, KonvaNodeDrawCost>;
  rectSceneDrawCostByRole: Record<string, KonvaNodeDrawCost>;
  rectNodeCompositionByRole: Record<string, KonvaRectRoleStyleCounters>;
  pointerMoveCalls: number;
  pointerEnterLeaveCalls: number;
  getIntersectionCalls: number;
  bySource: Record<string, number>;
  layers: KonvaLayerScopeMetrics[];
  rackLayerComposition: RackLayerNodeComposition;
  traces: KonvaTrace[];
};

type FrameBucket = {
  count: number;
  percent: number;
};

type FrameBuckets = {
  lte16Ms: FrameBucket;
  gt16To33Ms: FrameBucket;
  gt33To50Ms: FrameBucket;
  gt50To100Ms: FrameBucket;
  gt100To250Ms: FrameBucket;
  gt250To500Ms: FrameBucket;
  gt500Ms: FrameBucket;
};

type Metrics = {
  sampleDurationMs: number;
  frames: number;
  averageFps: number;
  p50Fps: number;
  p95FrameMs: number;
  worstFrameMs: number;
  droppedFramesOver50Ms: number;
  droppedFramesOver100Ms: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  memory: RawProbeResult['memory'];
};

type CullingMetrics = {
  cellsTotal: number;
  cellsRendered: number;
  cellsCulled: number;
  cullingRatio: number;
};

type DeltaVsProductionCulling = {
  averageFpsDelta: number;
  averageFpsDeltaPct: number | null;
  p95FrameMsDelta: number;
  p95FrameMsDeltaPct: number | null;
  worstFrameMsDelta: number;
  worstFrameMsDeltaPct: number | null;
  longTaskCountDelta: number;
  longTaskCountDeltaPct: number | null;
  droppedFramesOver50MsDelta: number;
  droppedFramesOver100MsDelta: number;
} | null;

type ReportEntry = {
  scenario: ScenarioName;
  variant: string;
  profile: DeviceProfile;
  flags: DiagnosticsFlags | null;
  metrics: Metrics;
  cellsTotal: number;
  cellsRendered: number;
  cellsCulled: number;
  cullingRatio: number;
  cullingMetrics: CullingMetrics;
  frameBuckets: FrameBuckets;
  budgetStatus: 'pass' | 'fail';
  budgetFailures: string[];
  deltaVsProductionCulling: DeltaVsProductionCulling;
  deltaVsFullRender: DeltaVsProductionCulling;
  renderPipeline: RenderPipelineDiagnostics;
  konvaPipeline: KonvaPipelineProbeResult;
  browserEnvironment: BrowserEnvironment;
  seed: {
    floorId: string;
    layoutVersionId: string;
    expectedPreviewCellCount: number;
  };
};

type BrowserEnvironment = {
  userAgent: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  devicePixelRatio: number;
};

const NORMAL_FLAGS: DiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  enableProductionCellCulling: true,
  rackLayerRenderer: 'layer'
};

const DEVICE_PROFILES: DeviceProfile[] = [
  {
    name: 'native-desktop',
    cpuThrottleRate: 1,
    viewport: { width: 1440, height: 900 }
  },
  {
    name: 'weak-laptop-cpu-4x',
    cpuThrottleRate: 4,
    viewport: { width: 1366, height: 768 }
  },
  ...(INCLUDE_LOW_END_PROFILE
    ? [
        {
          name: 'low-end-cpu-6x' as const,
          cpuThrottleRate: 6,
          viewport: { width: 1280, height: 720 }
        }
      ]
    : [])
];

const VARIANTS: Variant[] = [
  { name: 'production-culling', flags: null },
  {
    name: 'manual-pan-batchdraw-off',
    flags: null,
    runtimeOptions: { disableManualPanBatchDraw: true }
  },
  {
    name: 'rack-layer-listening-off-during-pan',
    flags: null,
    runtimeOptions: { rackLayerListeningOffDuringPan: true }
  },
  { name: 'labels-off', flags: { ...NORMAL_FLAGS, labels: 'off' } },
  { name: 'hit-test-off', flags: { ...NORMAL_FLAGS, hitTest: 'off' } },
  {
    name: 'no-overlays',
    flags: { ...NORMAL_FLAGS, cellOverlays: 'off' }
  },
  {
    name: 'no-hit-graph',
    flags: { ...NORMAL_FLAGS, hitTest: 'off' },
    runtimeOptions: { disableRackLayerHitGraph: true }
  },
  {
    name: 'fast-layer',
    flags: { ...NORMAL_FLAGS, rackLayerRenderer: 'fast-layer' }
  },
  {
    name: 'visible-cells-only',
    flags: { ...NORMAL_FLAGS, cells: 'visible-only' }
  },
  {
    name: 'unculled-baseline',
    flags: {
      ...NORMAL_FLAGS,
      cells: 'unculled',
      enableProductionCellCulling: false
    }
  },
  {
    name: 'surface-only',
    flags: { ...NORMAL_FLAGS, cellOverlays: 'surface-only' }
  },
  { name: 'rack-shell-only', flags: { ...NORMAL_FLAGS, cells: 'off' } }
];

const SCENARIOS: ScenarioName[] = [
  'pan',
  'zoom',
  'select',
  'hover',
  'load',
  'route-preview'
];

const PROFILE_BUDGETS = {
  'native-desktop': {
    p95FrameMs: 50,
    worstFrameMs: 100,
    longTaskCount: 30,
    averageFps: 45
  },
  'weak-laptop-cpu-4x': {
    p95FrameMs: 150,
    worstFrameMs: 300,
    longTaskCount: Number.POSITIVE_INFINITY,
    averageFps: 20
  },
  'low-end-cpu-6x': {
    p95FrameMs: 150,
    worstFrameMs: 300,
    longTaskCount: Number.POSITIVE_INFINITY,
    averageFps: 20
  }
} satisfies Record<
  DeviceProfile['name'],
  {
    p95FrameMs: number;
    worstFrameMs: number;
    longTaskCount: number;
    averageFps: number;
  }
>;

function includeByEnv<T extends string>(items: T[], envName: string) {
  const value = process.env[envName];
  if (!value) {
    return items;
  }
  const wanted = new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return items.filter((item) => wanted.has(item));
}

const selectedScenarios = includeByEnv(SCENARIOS, 'DL1_DIAGNOSTICS_SCENARIOS');
function normalizeVariantName(name: string) {
  return name === 'full-render' ? 'production-culling' : name;
}

const requestedVariantNames = includeByEnv(
  [...VARIANTS.map((item) => item.name), 'full-render'],
  'DL1_DIAGNOSTICS_VARIANTS'
).map(normalizeVariantName);
const selectedVariantNames = requestedVariantNames.includes(
  'production-culling'
)
  ? [...new Set(requestedVariantNames)]
  : ['production-culling', ...new Set(requestedVariantNames)];
const selectedVariants = VARIANTS.filter((variant) =>
  selectedVariantNames.includes(variant.name)
);
const selectedProfiles = DEVICE_PROFILES.filter((profile) =>
  includeByEnv(
    DEVICE_PROFILES.map((item) => item.name),
    'DL1_DIAGNOSTICS_PROFILES'
  ).includes(profile.name)
);

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );

  return sorted[index] ?? 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function pct(part: number, total: number) {
  return total > 0 ? round((part / total) * 100) : 0;
}

function deltaPct(value: number, baseline: number) {
  return baseline !== 0 ? round((value / baseline) * 100) : null;
}

function bucket(count: number, total: number): FrameBucket {
  return {
    count,
    percent: pct(count, total)
  };
}

function summarizeFrameBuckets(frameTimes: number[]): FrameBuckets {
  const total = frameTimes.length;
  return {
    lte16Ms: bucket(frameTimes.filter((value) => value <= 16).length, total),
    gt16To33Ms: bucket(
      frameTimes.filter((value) => value > 16 && value <= 33).length,
      total
    ),
    gt33To50Ms: bucket(
      frameTimes.filter((value) => value > 33 && value <= 50).length,
      total
    ),
    gt50To100Ms: bucket(
      frameTimes.filter((value) => value > 50 && value <= 100).length,
      total
    ),
    gt100To250Ms: bucket(
      frameTimes.filter((value) => value > 100 && value <= 250).length,
      total
    ),
    gt250To500Ms: bucket(
      frameTimes.filter((value) => value > 250 && value <= 500).length,
      total
    ),
    gt500Ms: bucket(frameTimes.filter((value) => value > 500).length, total)
  };
}

function summarizeMetrics(raw: RawProbeResult): {
  metrics: Metrics;
  frameBuckets: FrameBuckets;
} {
  const frameTimes = raw.frameTimes.filter(
    (value) => Number.isFinite(value) && value > 0
  );
  const totalFrameMs = frameTimes.reduce((sum, value) => sum + value, 0);
  const averageFrameMs =
    frameTimes.length > 0 ? totalFrameMs / frameTimes.length : 0;
  const p50FrameMs = percentile(frameTimes, 50);
  const p95FrameMs = percentile(frameTimes, 95);
  const worstFrameMs = frameTimes.length > 0 ? Math.max(...frameTimes) : 0;
  const longTaskTotalMs = raw.longTasks.reduce(
    (sum, task) => sum + task.duration,
    0
  );

  return {
    metrics: {
      sampleDurationMs: SAMPLE_DURATION_MS,
      frames: frameTimes.length,
      averageFps: averageFrameMs > 0 ? round(1000 / averageFrameMs) : 0,
      p50Fps: p50FrameMs > 0 ? round(1000 / p50FrameMs) : 0,
      p95FrameMs: round(p95FrameMs),
      worstFrameMs: round(worstFrameMs),
      droppedFramesOver50Ms: frameTimes.filter((value) => value > 50).length,
      droppedFramesOver100Ms: frameTimes.filter((value) => value > 100).length,
      longTaskCount: raw.longTasks.length,
      longTaskTotalMs: round(longTaskTotalMs),
      memory: raw.memory
    },
    frameBuckets: summarizeFrameBuckets(frameTimes)
  };
}

function evaluateBudget(profile: DeviceProfile, metrics: Metrics) {
  const budget = PROFILE_BUDGETS[profile.name];
  const failures = [
    metrics.p95FrameMs <= budget.p95FrameMs
      ? null
      : `p95FrameMs ${metrics.p95FrameMs} > ${budget.p95FrameMs}`,
    metrics.worstFrameMs <= budget.worstFrameMs
      ? null
      : `worstFrameMs ${metrics.worstFrameMs} > ${budget.worstFrameMs}`,
    metrics.longTaskCount <= budget.longTaskCount
      ? null
      : `longTaskCount ${metrics.longTaskCount} > ${budget.longTaskCount}`,
    metrics.averageFps >= budget.averageFps
      ? null
      : `averageFps ${metrics.averageFps} < ${budget.averageFps}`
  ].filter((failure): failure is string => failure !== null);

  return {
    budgetStatus: failures.length === 0 ? ('pass' as const) : ('fail' as const),
    budgetFailures: failures
  };
}

function summarizeDelta(
  metrics: Metrics,
  baseline: Metrics | null
): DeltaVsProductionCulling {
  if (!baseline) {
    return null;
  }

  const averageFpsDelta = round(metrics.averageFps - baseline.averageFps);
  const p95FrameMsDelta = round(metrics.p95FrameMs - baseline.p95FrameMs);
  const worstFrameMsDelta = round(metrics.worstFrameMs - baseline.worstFrameMs);
  const longTaskCountDelta = metrics.longTaskCount - baseline.longTaskCount;

  return {
    averageFpsDelta,
    averageFpsDeltaPct: deltaPct(averageFpsDelta, baseline.averageFps),
    p95FrameMsDelta,
    p95FrameMsDeltaPct: deltaPct(p95FrameMsDelta, baseline.p95FrameMs),
    worstFrameMsDelta,
    worstFrameMsDeltaPct: deltaPct(worstFrameMsDelta, baseline.worstFrameMs),
    longTaskCountDelta,
    longTaskCountDeltaPct: deltaPct(longTaskCountDelta, baseline.longTaskCount),
    droppedFramesOver50MsDelta:
      metrics.droppedFramesOver50Ms - baseline.droppedFramesOver50Ms,
    droppedFramesOver100MsDelta:
      metrics.droppedFramesOver100Ms - baseline.droppedFramesOver100Ms
  };
}

async function setDiagnosticsFlags(page: Page, flags: DiagnosticsFlags | null) {
  await page.evaluate(
    ({ nextFlags, storageKey, eventName }) => {
      const global = window as unknown as {
        __WOS_CANVAS_PERF_DIAGNOSTICS__?: DiagnosticsFlags;
      };
      if (nextFlags) {
        global.__WOS_CANVAS_PERF_DIAGNOSTICS__ = nextFlags;
        window.sessionStorage.setItem(storageKey, JSON.stringify(nextFlags));
      } else {
        delete global.__WOS_CANVAS_PERF_DIAGNOSTICS__;
        window.sessionStorage.removeItem(storageKey);
      }
      window.dispatchEvent(new Event(eventName));
      const metricsGlobal = window as unknown as {
        __WOS_CANVAS_CULLING_METRIC_SOURCES__?: Record<
          string,
          { cellsTotal: number; cellsRendered: number }
        >;
        __WOS_CANVAS_CULLING_METRICS__?: CullingMetrics;
      };
      metricsGlobal.__WOS_CANVAS_CULLING_METRIC_SOURCES__ = {};
      metricsGlobal.__WOS_CANVAS_CULLING_METRICS__ = {
        cellsTotal: 0,
        cellsRendered: 0,
        cellsCulled: 0,
        cullingRatio: 1
      };
    },
    {
      nextFlags: flags,
      storageKey: DIAGNOSTICS_STORAGE_KEY,
      eventName: DIAGNOSTICS_EVENT
    }
  );
}

async function setVariantRuntimeOptions(
  page: Page,
  options: VariantRuntimeOptions | undefined
) {
  await page.evaluate((nextOptions) => {
    const global = window as Window & {
      __WOS_CANVAS_DISABLE_MANUAL_PAN_BATCH_DRAW__?: boolean;
    };
    global.__WOS_CANVAS_DISABLE_MANUAL_PAN_BATCH_DRAW__ =
      nextOptions?.disableManualPanBatchDraw === true;
  }, options ?? {});
}

async function setRackLayerHitGraphDisabled(page: Page, disabled: boolean) {
  await page.evaluate((nextDisabled) => {
    const global = window as Window & {
      __WOS_CANVAS_STAGE__?: any;
      __dl1RackLayerHitGraphRestore?: (() => void) | null;
    };

    global.__dl1RackLayerHitGraphRestore?.();
    global.__dl1RackLayerHitGraphRestore = null;
    if (!nextDisabled) return;

    const stage = global.__WOS_CANVAS_STAGE__;
    const layers =
      stage && typeof stage.getLayers === 'function' ? stage.getLayers() : [];
    const restorers = layers.map((layer: any) => {
      const previousListening =
        typeof layer.listening === 'function' ? layer.listening() : true;
      const previousHitGraphEnabled =
        typeof layer.hitGraphEnabled === 'function'
          ? layer.hitGraphEnabled()
          : undefined;
      const previousDrawHit = layer.drawHit;

      if (typeof layer.listening === 'function') {
        layer.listening(false);
      }
      if (typeof layer.hitGraphEnabled === 'function') {
        layer.hitGraphEnabled(false);
      }
      if (typeof previousDrawHit === 'function') {
        layer.drawHit = function disabledLayerDrawHit() {
          return this;
        };
      }
      layer.batchDraw?.();

      return () => {
        if (typeof layer.listening === 'function') {
          layer.listening(previousListening);
        }
        if (
          previousHitGraphEnabled !== undefined &&
          typeof layer.hitGraphEnabled === 'function'
        ) {
          layer.hitGraphEnabled(previousHitGraphEnabled);
        }
        if (typeof previousDrawHit === 'function') {
          layer.drawHit = previousDrawHit;
        }
        layer.batchDraw?.();
      };
    });
    global.__dl1RackLayerHitGraphRestore = () => {
      for (const restore of restorers) restore();
    };
  }, disabled);
  await page.waitForTimeout(50);
}

async function setRackLayerListening(page: Page, listening: boolean) {
  await page.evaluate((nextListening) => {
    const global = window as Window & {
      __WOS_CANVAS_STAGE__?: any;
    };
    const stage = global.__WOS_CANVAS_STAGE__;
    const layers =
      stage && typeof stage.getLayers === 'function' ? stage.getLayers() : [];
    const rackLayer = layers.find((layer: any) => {
      const name =
        typeof layer.name === 'function'
          ? layer.name()
          : typeof layer.getAttr === 'function'
            ? layer.getAttr('name')
            : '';
      return name === 'rack-layer';
    });
    if (!rackLayer) {
      throw new Error('DL1 diagnostics could not find rack-layer.');
    }
    rackLayer.listening(nextListening);
    rackLayer.batchDraw();
  }, listening);
  await page.waitForTimeout(50);
}

async function installDiagnosticsInitScript(context: BrowserContext) {
  await context.addInitScript(
    ({ storageKey }) => {
      const global = window as unknown as {
        __WOS_CANVAS_PERF_DIAGNOSTICS__?: DiagnosticsFlags;
      };
      const rawFlags = window.sessionStorage.getItem(storageKey);
      if (!rawFlags) {
        delete global.__WOS_CANVAS_PERF_DIAGNOSTICS__;
        return;
      }

      try {
        global.__WOS_CANVAS_PERF_DIAGNOSTICS__ = JSON.parse(
          rawFlags
        ) as DiagnosticsFlags;
      } catch {
        delete global.__WOS_CANVAS_PERF_DIAGNOSTICS__;
      }
    },
    { storageKey: DIAGNOSTICS_STORAGE_KEY }
  );
}

async function getCanvasCullingMetrics(page: Page): Promise<CullingMetrics> {
  return page.evaluate(() => {
    const global = window as unknown as {
      __WOS_CANVAS_CULLING_METRICS__?: CullingMetrics;
    };
    return (
      global.__WOS_CANVAS_CULLING_METRICS__ ?? {
        cellsTotal: 0,
        cellsRendered: 0,
        cellsCulled: 0,
        cullingRatio: 1
      }
    );
  });
}

async function startRenderPipelineProbe(page: Page) {
  await page.evaluate(() => {
    const createComponentMetrics = () => ({
      renders: 0,
      causes: {
        stateUpdates: 0,
        propsChanges: 0,
        parentRerenders: 0
      },
      changedKeys: {}
    });
    const global = window as unknown as {
      __WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__?: RenderPipelineDiagnostics;
      __WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__?: Record<
        string,
        Record<string, unknown>
      >;
    };
    global.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ = {
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
    global.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = {};
  });
}

async function stopRenderPipelineProbe(
  page: Page
): Promise<RenderPipelineDiagnostics> {
  return page.evaluate(() => {
    const global = window as unknown as {
      __WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__?: RenderPipelineDiagnostics;
    };
    const diagnostics = global.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__;
    if (!diagnostics) {
      throw new Error('DL1 render pipeline probe was not started.');
    }

    diagnostics.enabled = false;
    return diagnostics;
  });
}

async function startKonvaPipelineProbe(page: Page) {
  await page.evaluate(() => {
    type MutableKonvaProbeResult = KonvaPipelineProbeResult & {
      events: KonvaCallEvent[];
    };
    type ProbeGlobal = Window & {
      __WOS_CANVAS_STAGE__?: any;
      __WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__?: boolean;
      __WOS_CANVAS_KONVA_SOURCE__?: string | null;
      __dl1KonvaProbe?: MutableKonvaProbeResult;
      __dl1KonvaProbeRestore?: Array<() => void>;
      Konva?: { autoDrawEnabled?: boolean };
    };

    const global = window as ProbeGlobal;
    for (const restore of global.__dl1KonvaProbeRestore ?? []) {
      restore();
    }
    global.__dl1KonvaProbeRestore = [];

    const stage = global.__WOS_CANVAS_STAGE__;
    if (!stage) {
      throw new Error('DL1 Konva probe could not find window.__WOS_CANVAS_STAGE__.');
    }

    const layers = typeof stage.getLayers === 'function' ? stage.getLayers() : [];
    const firstLayer = layers[0];
    if (!firstLayer) {
      throw new Error('DL1 Konva probe could not find Stage layers.');
    }

    const findProtoWith = (instance: any, methodName: string) => {
      if (!instance) return null;
      let proto = Object.getPrototypeOf(instance);
      while (proto) {
        if (typeof proto[methodName] === 'function') return proto;
        proto = Object.getPrototypeOf(proto);
      }
      return null;
    };

    const probe: MutableKonvaProbeResult = {
      autoDrawEnabled:
        typeof global.__WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__ === 'boolean'
          ? global.__WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__
          : typeof global.Konva?.autoDrawEnabled === 'boolean'
            ? global.Konva.autoDrawEnabled
            : null,
      stageAutoDrawAttr:
        typeof stage.getAttr === 'function'
          ? stage.getAttr('autoDrawEnabled')
          : undefined,
      stageBatchDrawCalls: 0,
      stagePositionCalls: 0,
      nodeRequestDrawCalls: 0,
      layerBatchDrawCalls: 0,
      layerDrawCalls: 0,
      drawSceneCalls: 0,
      drawHitCalls: 0,
      drawSceneTotalMs: 0,
      drawHitTotalMs: 0,
      nodeSceneDrawCostByType: {},
      nodeSceneDrawCostBuckets: {},
      rectSceneDrawCostByRole: {},
      rectNodeCompositionByRole: {},
      pointerMoveCalls: 0,
      pointerEnterLeaveCalls: 0,
      getIntersectionCalls: 0,
      bySource: {},
      layers: [],
      rackLayerComposition: {
        total: 0,
        byType: {},
        listeningTrue: 0,
        hitGraphEligible: 0
      },
      traces: [],
      events: []
    };

    let eventIndex = 0;
    let currentTraceId: number | null = null;
    let nextTraceId = 1;
    const maxTraces = 10;

    const getLayerName = (layer: any) => {
      if (!layer) return undefined;
      const name =
        typeof layer.name === 'function'
          ? layer.name()
          : typeof layer.getAttr === 'function'
            ? layer.getAttr('name')
            : '';
      const index = typeof layer.index === 'number' ? layer.index : '?';
      return name || `${layer.getType?.() ?? 'Layer'}#${index}`;
    };

    const getNodeType = (node: any) =>
      node?.className ?? node?.nodeType ?? node?.getType?.() ?? 'Unknown';

    const getRectRole = (node: any) => {
      const rawRole =
        typeof node?.getAttr === 'function' ? node.getAttr('wosRectRole') : null;
      return typeof rawRole === 'string' && rawRole.length > 0
        ? rawRole
        : 'unknown';
    };

    const readSource = () =>
      global.__WOS_CANVAS_KONVA_SOURCE__ ?? 'unknown';

    const ensureTrace = () => {
      if (currentTraceId !== null) return currentTraceId;
      currentTraceId = nextTraceId;
      nextTraceId += 1;
      if (probe.traces.length < maxTraces) {
        probe.traces.push({ traceId: currentTraceId, events: [] });
      }
      return currentTraceId;
    };

    const record = (
      name: string,
      details: Partial<Omit<KonvaCallEvent, 'index' | 'name' | 'timeMs'>> = {}
    ) => {
      const source = details.source ?? readSource();
      const event: KonvaCallEvent = {
        index: eventIndex,
        traceId: currentTraceId,
        name,
        source,
        timeMs: Math.round(performance.now() * 100) / 100,
        layerName: details.layerName,
        nodeType: details.nodeType,
        detail: details.detail
      };
      eventIndex += 1;
      probe.events.push(event);
      probe.bySource[source] = (probe.bySource[source] ?? 0) + 1;
      const trace = probe.traces.find((item) => item.traceId === event.traceId);
      trace?.events.push(event);
      return event;
    };

    const wrapProto = (
      proto: any,
      methodName: string,
      wrapper: (original: (...args: any[]) => any, self: any, args: any[]) => any
    ) => {
      if (!proto) return;
      const original = proto[methodName];
      if (typeof original !== 'function') return;
      proto[methodName] = function wrappedKonvaProbeMethod(...args: any[]) {
        return wrapper(original, this, args);
      };
      global.__dl1KonvaProbeRestore?.push(() => {
        proto[methodName] = original;
      });
    };

    type MutableNodeDrawCost = KonvaNodeDrawCost & { samples: number[] };

    const normalizeDrawBucket = (nodeType: string) => {
      if (nodeType === 'Text') return 'Text';
      if (nodeType === 'Rect') return 'Rect';
      if (nodeType === 'Group') return 'Group';
      if (['Line', 'Circle', 'Ellipse', 'Path', 'Shape'].includes(nodeType)) {
        return 'Lines / Shapes';
      }
      return 'Other';
    };

    const recordNodeDrawCost = (
      nodeType: string,
      durationMs: number,
      rectRole?: string
    ) => {
      const update = (target: Record<string, KonvaNodeDrawCost>, key: string) => {
        const metric = (target[key] ?? {
          calls: 0,
          totalMs: 0,
          p95Ms: 0,
          maxMs: 0,
          samples: []
        }) as MutableNodeDrawCost;
        metric.calls += 1;
        metric.totalMs += durationMs;
        metric.maxMs = Math.max(metric.maxMs, durationMs);
        metric.samples.push(durationMs);
        target[key] = metric;
      };

      update(probe.nodeSceneDrawCostByType, nodeType);
      update(probe.nodeSceneDrawCostBuckets, normalizeDrawBucket(nodeType));
      if (nodeType === 'Rect') {
        update(probe.rectSceneDrawCostByRole, rectRole ?? 'unknown');
      }
    };

    const nodeDrawStack: Array<{ childMs: number }> = [];
    const measureNodeSceneDraw = (
      nodeType: string,
      rectRole: string | undefined,
      callback: () => unknown
    ) => {
      const frame = { childMs: 0 };
      nodeDrawStack.push(frame);
      const start = performance.now();
      try {
        return callback();
      } finally {
        const totalMs = performance.now() - start;
        nodeDrawStack.pop();
        const exclusiveMs = Math.max(0, totalMs - frame.childMs);
        recordNodeDrawCost(nodeType, exclusiveMs, rectRole);
        const parent = nodeDrawStack[nodeDrawStack.length - 1];
        if (parent) parent.childMs += totalMs;
      }
    };

    const collectNodes = (root: any) => {
      const nodes: any[] = [];
      const visit = (node: any) => {
        nodes.push(node);
        const children =
          typeof node.getChildren === 'function' ? node.getChildren() : [];
        children.forEach((child: any) => visit(child));
      };
      visit(root);
      return nodes;
    };

    const rackLayerForNodeProbe =
      layers.find((layer: any) => getLayerName(layer) === 'rack-layer') ??
      firstLayer;
    const rackNodesForNodeProbe = collectNodes(rackLayerForNodeProbe);
    const firstGroupNode = rackNodesForNodeProbe.find(
      (node) => getNodeType(node) === 'Group'
    );
    const shapeDrawSceneProtos = [
      ...new Set(
        rackNodesForNodeProbe
          .filter((node) =>
            ['Text', 'Rect', 'Line', 'Circle', 'Ellipse', 'Path', 'Shape'].includes(
              getNodeType(node)
            )
          )
          .map((node) => findProtoWith(node, 'drawScene'))
          .filter(Boolean)
      )
    ];

    wrapProto(findProtoWith(firstGroupNode, 'drawScene'), 'drawScene', (original, self, args) => {
      const nodeType = getNodeType(self);
      if (nodeType !== 'Group') {
        return original.apply(self, args);
      }
      return measureNodeSceneDraw(nodeType, undefined, () =>
        original.apply(self, args)
      );
    });

    for (const proto of shapeDrawSceneProtos) {
      wrapProto(proto, 'drawScene', (original, self, args) => {
        const nodeType = getNodeType(self);
        return measureNodeSceneDraw(
          nodeType,
          nodeType === 'Rect' ? getRectRole(self) : undefined,
          () => original.apply(self, args)
        );
      });
    }

    wrapProto(findProtoWith(stage, 'position'), 'position', (original, self, args) => {
      if (args.length > 0) {
        currentTraceId = nextTraceId;
        nextTraceId += 1;
        if (probe.traces.length < maxTraces) {
          probe.traces.push({ traceId: currentTraceId, events: [] });
        }
        probe.stagePositionCalls += 1;
        record('stage.position', {
          nodeType: self.getType?.() ?? self.nodeType ?? 'Stage',
          detail: JSON.stringify(args[0] ?? null)
        });
      }
      return original.apply(self, args);
    });

    wrapProto(findProtoWith(stage, '_requestDraw'), '_requestDraw', (original, self, args) => {
      ensureTrace();
      probe.nodeRequestDrawCalls += 1;
      record('Node._requestDraw', {
        nodeType: self.getType?.() ?? self.nodeType ?? self.className,
        layerName: getLayerName(typeof self.getLayer === 'function' ? self.getLayer() : null)
      });
      return original.apply(self, args);
    });

    wrapProto(findProtoWith(stage, 'batchDraw'), 'batchDraw', (original, self, args) => {
      ensureTrace();
      probe.stageBatchDrawCalls += 1;
      record('Stage.batchDraw', {
        nodeType: self.getType?.() ?? 'Stage'
      });
      return original.apply(self, args);
    });

    wrapProto(findProtoWith(firstLayer, 'batchDraw'), 'batchDraw', (original, self, args) => {
      ensureTrace();
      probe.layerBatchDrawCalls += 1;
      record('Layer.batchDraw', {
        layerName: getLayerName(self),
        nodeType: self.getType?.() ?? 'Layer',
        detail: `_waitingForDraw=${String(self._waitingForDraw)}`
      });
      return original.apply(self, args);
    });

    wrapProto(findProtoWith(firstLayer, 'draw'), 'draw', (original, self, args) => {
      ensureTrace();
      probe.layerDrawCalls += 1;
      record('Layer.draw', {
        source: readSource() === 'unknown' ? 'konva-scheduled-draw' : readSource(),
        layerName: getLayerName(self),
        nodeType: self.getType?.() ?? 'Layer'
      });
      return original.apply(self, args);
    });

    wrapProto(findProtoWith(firstLayer, 'drawScene'), 'drawScene', (original, self, args) => {
      ensureTrace();
      probe.drawSceneCalls += 1;
      record('drawScene', {
        source: readSource() === 'unknown' ? 'konva-scheduled-draw' : readSource(),
        layerName: getLayerName(self),
        nodeType: self.getType?.() ?? 'Layer'
      });
      const start = performance.now();
      const result = original.apply(self, args);
      probe.drawSceneTotalMs += performance.now() - start;
      return result;
    });

    wrapProto(findProtoWith(firstLayer, 'drawHit'), 'drawHit', (original, self, args) => {
      ensureTrace();
      probe.drawHitCalls += 1;
      record('drawHit', {
        source: readSource() === 'unknown' ? 'konva-scheduled-draw' : readSource(),
        layerName: getLayerName(self),
        nodeType: self.getType?.() ?? 'Layer'
      });
      const start = performance.now();
      const result = original.apply(self, args);
      probe.drawHitTotalMs += performance.now() - start;
      return result;
    });

    wrapProto(findProtoWith(firstLayer, 'getIntersection'), 'getIntersection', (original, self, args) => {
      ensureTrace();
      probe.getIntersectionCalls += 1;
      record('Layer.getIntersection', {
        source: 'interaction-hit-test',
        layerName: getLayerName(self),
        nodeType: self.getType?.() ?? 'Layer'
      });
      return original.apply(self, args);
    });

    for (const layer of layers) {
      if (Object.prototype.hasOwnProperty.call(layer, 'batchDraw')) {
        wrapProto(layer, 'batchDraw', (original, self, args) => {
          ensureTrace();
          probe.layerBatchDrawCalls += 1;
          record('Layer.batchDraw', {
            layerName: getLayerName(self),
            nodeType: self.getType?.() ?? 'Layer',
            detail: `_waitingForDraw=${String(self._waitingForDraw)}`
          });
          return original.apply(self, args);
        });
      }
      if (Object.prototype.hasOwnProperty.call(layer, 'draw')) {
        wrapProto(layer, 'draw', (original, self, args) => {
          ensureTrace();
          probe.layerDrawCalls += 1;
          record('Layer.draw', {
            source:
              readSource() === 'unknown'
                ? 'konva-scheduled-draw'
                : readSource(),
            layerName: getLayerName(self),
            nodeType: self.getType?.() ?? 'Layer'
          });
          return original.apply(self, args);
        });
      }
    }

    wrapProto(findProtoWith(stage, 'getIntersection'), 'getIntersection', (original, self, args) => {
      ensureTrace();
      probe.getIntersectionCalls += 1;
      record('Stage.getIntersection', {
        source: 'interaction-hit-test',
        nodeType: self.getType?.() ?? 'Stage'
      });
      return original.apply(self, args);
    });

    for (const methodName of ['_pointermove', '_pointerover', '_pointerenter', '_pointerleave']) {
      wrapProto(findProtoWith(stage, methodName), methodName, (original, self, args) => {
        ensureTrace();
        if (methodName === '_pointermove') {
          probe.pointerMoveCalls += 1;
        } else {
          probe.pointerEnterLeaveCalls += 1;
        }
        record(`Stage.${methodName}`, {
          source: 'interaction-pointer',
          nodeType: self.getType?.() ?? 'Stage'
        });
        return original.apply(self, args);
      });
    }

    global.__dl1KonvaProbe = probe;
  });
}

async function stopKonvaPipelineProbe(
  page: Page
): Promise<KonvaPipelineProbeResult> {
  return page.evaluate(() => {
    type ProbeGlobal = Window & {
      __WOS_CANVAS_STAGE__?: any;
      __WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__?: boolean;
      __dl1KonvaProbe?: KonvaPipelineProbeResult & {
        events?: KonvaCallEvent[];
      };
      __dl1KonvaProbeRestore?: Array<() => void>;
      Konva?: { autoDrawEnabled?: boolean };
    };
    const global = window as ProbeGlobal;
    const probe = global.__dl1KonvaProbe;
    const stage = global.__WOS_CANVAS_STAGE__;
    if (!probe || !stage) {
      throw new Error('DL1 Konva pipeline probe was not started.');
    }

    const layers = typeof stage.getLayers === 'function' ? stage.getLayers() : [];
    const getLayerName = (layer: any) => {
      const name =
        typeof layer.name === 'function'
          ? layer.name()
          : typeof layer.getAttr === 'function'
            ? layer.getAttr('name')
            : '';
      const index = typeof layer.index === 'number' ? layer.index : '?';
      return name || `${layer.getType?.() ?? 'Layer'}#${index}`;
    };
    const getNodeType = (node: any) =>
      node?.className ?? node?.nodeType ?? node?.getType?.() ?? 'Unknown';
    const getRectRole = (node: any) => {
      const rawRole =
        typeof node?.getAttr === 'function' ? node.getAttr('wosRectRole') : null;
      return typeof rawRole === 'string' && rawRole.length > 0
        ? rawRole
        : 'unknown';
    };
    const readBoolAttr = (node: any, methodName: string, attrName: string) => {
      if (typeof node?.[methodName] === 'function') {
        return node[methodName]() !== false;
      }
      if (typeof node?.getAttr === 'function') {
        const raw = node.getAttr(attrName);
        return raw !== false;
      }
      return true;
    };
    const readNumberAttr = (node: any, methodName: string, attrName: string) => {
      const raw =
        typeof node?.[methodName] === 'function'
          ? node[methodName]()
          : typeof node?.getAttr === 'function'
            ? node.getAttr(attrName)
            : undefined;
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    };
    const recordRectStyleCounters = (
      node: any,
      role: string,
      isListening: boolean,
      isVisible: boolean
    ) => {
      const counters = probe.rectNodeCompositionByRole[role] ?? {
        nodes: 0,
        fillEnabled: 0,
        strokeEnabled: 0,
        opacityLt1: 0,
        shadowEnabled: 0,
        dashEnabled: 0,
        listeningTrue: 0,
        hitGraphEligible: 0,
        strokeWidths: {}
      };
      const fillEnabled = readBoolAttr(node, 'fillEnabled', 'fillEnabled');
      const strokeEnabled = readBoolAttr(node, 'strokeEnabled', 'strokeEnabled');
      const fillPaint =
        typeof node?.fill === 'function'
          ? node.fill()
          : typeof node?.getAttr === 'function'
            ? node.getAttr('fill')
            : undefined;
      const strokePaint =
        typeof node?.stroke === 'function'
          ? node.stroke()
          : typeof node?.getAttr === 'function'
            ? node.getAttr('stroke')
            : undefined;
      const opacity = readNumberAttr(node, 'opacity', 'opacity');
      const shadowOpacity = readNumberAttr(
        node,
        'shadowOpacity',
        'shadowOpacity'
      );
      const shadowBlur = readNumberAttr(node, 'shadowBlur', 'shadowBlur');
      const shadowOffsetX = readNumberAttr(
        node,
        'shadowOffsetX',
        'shadowOffsetX'
      );
      const shadowOffsetY = readNumberAttr(
        node,
        'shadowOffsetY',
        'shadowOffsetY'
      );
      const shadowEnabled = readBoolAttr(
        node,
        'shadowEnabled',
        'shadowEnabled'
      );
      const strokeWidth = readNumberAttr(node, 'strokeWidth', 'strokeWidth');
      const dash =
        typeof node?.dash === 'function'
          ? node.dash()
          : typeof node?.getAttr === 'function'
            ? node.getAttr('dash')
            : undefined;

      counters.nodes += 1;
      if (fillEnabled && fillPaint != null) counters.fillEnabled += 1;
      if (strokeEnabled && strokePaint != null) counters.strokeEnabled += 1;
      if (opacity < 1) counters.opacityLt1 += 1;
      if (
        shadowEnabled &&
        shadowOpacity > 0 &&
        (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0)
      ) {
        counters.shadowEnabled += 1;
      }
      if (Array.isArray(dash) && dash.length > 0) counters.dashEnabled += 1;
      if (isListening) counters.listeningTrue += 1;
      if (isListening && isVisible) counters.hitGraphEligible += 1;
      if (strokeEnabled && strokePaint != null) {
        const strokeWidthKey = String(Math.round(strokeWidth * 100) / 100);
        counters.strokeWidths[strokeWidthKey] =
          (counters.strokeWidths[strokeWidthKey] ?? 0) + 1;
      }
      probe.rectNodeCompositionByRole[role] = counters;
    };

    const visit = (
      node: any,
      composition: RackLayerNodeComposition,
      parentListening = true,
      parentVisible = true
    ) => {
      const nodeType = getNodeType(node);
      const isListening =
        typeof node.isListening === 'function'
          ? node.isListening()
          : parentListening;
      const isVisible =
        typeof node.isVisible === 'function'
          ? node.isVisible()
          : parentVisible;
      composition.total += 1;
      composition.byType[nodeType] = (composition.byType[nodeType] ?? 0) + 1;
      if (isListening) composition.listeningTrue += 1;
      if (isListening && isVisible) composition.hitGraphEligible += 1;
      if (nodeType === 'Rect') {
        recordRectStyleCounters(node, getRectRole(node), isListening, isVisible);
      }
      const children =
        typeof node.getChildren === 'function' ? node.getChildren() : [];
      children.forEach((child: any) => visit(child, composition, isListening, isVisible));
    };

    const rackLayer = layers.find((layer: any) => getLayerName(layer) === 'rack-layer') ?? null;
    const rackLayerComposition: RackLayerNodeComposition = {
      total: 0,
      byType: {},
      listeningTrue: 0,
      hitGraphEligible: 0
    };
    if (rackLayer) {
      visit(rackLayer, rackLayerComposition);
    }

    const eventSourceCount = (layerName: string, eventName: string) =>
      (probe.events ?? []).filter(
        (event) => event.layerName === layerName && event.name === eventName
      ).length;

    const layerResults: KonvaLayerScopeMetrics[] = layers.map((layer: any) => {
      const name = getLayerName(layer);
      return {
        name,
        nodeType: layer.getType?.() ?? 'Layer',
        batchDrawCalls: eventSourceCount(name, 'Layer.batchDraw'),
        drawCalls: eventSourceCount(name, 'Layer.draw'),
        drawSceneCalls: eventSourceCount(name, 'drawScene'),
        drawHitCalls: eventSourceCount(name, 'drawHit'),
        getIntersectionCalls: eventSourceCount(name, 'Layer.getIntersection'),
        listening:
          typeof layer.isListening === 'function' ? layer.isListening() : false
      };
    });

    for (const restore of global.__dl1KonvaProbeRestore ?? []) {
      restore();
    }
    global.__dl1KonvaProbeRestore = [];
    global.__dl1KonvaProbe = undefined;
    const { events: _events, ...publicProbe } = probe;
    void _events;
    const finalizeDrawCost = (input: Record<string, KonvaNodeDrawCost>) => {
      const result: Record<string, KonvaNodeDrawCost> = {};
      for (const [key, value] of Object.entries(input)) {
        const samples = ((value as KonvaNodeDrawCost & { samples?: number[] })
          .samples ?? []) as number[];
        const sorted = [...samples].sort((a, b) => a - b);
        const p95Index = Math.min(
          sorted.length - 1,
          Math.max(0, Math.ceil(0.95 * sorted.length) - 1)
        );
        result[key] = {
          calls: value.calls,
          totalMs: Math.round(value.totalMs * 100) / 100,
          p95Ms: Math.round((sorted[p95Index] ?? value.p95Ms) * 100) / 100,
          maxMs: Math.round(value.maxMs * 100) / 100
        };
      }
      return result;
    };

    return {
      ...publicProbe,
      drawSceneTotalMs: Math.round(publicProbe.drawSceneTotalMs * 100) / 100,
      drawHitTotalMs: Math.round(publicProbe.drawHitTotalMs * 100) / 100,
      nodeSceneDrawCostByType: finalizeDrawCost(
        publicProbe.nodeSceneDrawCostByType
      ),
      nodeSceneDrawCostBuckets: finalizeDrawCost(
        publicProbe.nodeSceneDrawCostBuckets
      ),
      rectSceneDrawCostByRole: finalizeDrawCost(
        publicProbe.rectSceneDrawCostByRole
      ),
      rectNodeCompositionByRole: publicProbe.rectNodeCompositionByRole,
      autoDrawEnabled:
        typeof global.__WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__ === 'boolean'
          ? global.__WOS_CANVAS_KONVA_AUTO_DRAW_ENABLED__
          : typeof global.Konva?.autoDrawEnabled === 'boolean'
            ? global.Konva.autoDrawEnabled
            : probe.autoDrawEnabled,
      stageAutoDrawAttr:
        typeof stage.getAttr === 'function'
          ? stage.getAttr('autoDrawEnabled')
          : probe.stageAutoDrawAttr,
      layers: layerResults,
      rackLayerComposition
    };
  });
}

async function startFrameProbe(page: Page) {
  await page.evaluate(() => {
    type ProbeState = {
      stop: () => RawProbeResult;
    };
    const global = window as unknown as { __dl1FrameProbe?: ProbeState };
    global.__dl1FrameProbe?.stop();

    const frameTimes: number[] = [];
    const longTasks: RawProbeResult['longTasks'] = [];
    let previousFrameTime: number | null = null;
    let stopped = false;
    let rafId = 0;
    let observer: PerformanceObserver | null = null;

    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      observer = null;
    }

    const tick = (time: number) => {
      if (stopped) {
        return;
      }

      if (previousFrameTime !== null) {
        frameTimes.push(time - previousFrameTime);
      }
      previousFrameTime = time;
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    global.__dl1FrameProbe = {
      stop: () => {
        stopped = true;
        window.cancelAnimationFrame(rafId);
        observer?.disconnect();

        const memoryInfo =
          'memory' in performance
            ? (performance.memory as NonNullable<RawProbeResult['memory']>)
            : null;
        const memory = memoryInfo
          ? {
              usedJSHeapSize: memoryInfo.usedJSHeapSize,
              totalJSHeapSize: memoryInfo.totalJSHeapSize,
              jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit
            }
          : null;

        return {
          frameTimes,
          longTasks,
          memory
        };
      }
    };
  });
}

async function stopFrameProbe(page: Page) {
  return page.evaluate(() => {
    const global = window as unknown as {
      __dl1FrameProbe?: { stop: () => RawProbeResult };
    };
    const result = global.__dl1FrameProbe?.stop();
    global.__dl1FrameProbe = undefined;

    if (!result) {
      throw new Error('DL1 frame probe was not started.');
    }

    return result;
  });
}

async function waitForWarehouseCanvas(page: Page) {
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
  await page.waitForTimeout(250);
}

async function getCanvasBox(page: Page) {
  const canvas = page.locator('.konvajs-content canvas').first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Warehouse canvas is not visible.');
  }
  return box;
}

async function switchToViewMode(page: Page) {
  const viewButton = page.getByRole('button', { name: 'View' });
  if (await viewButton.count()) {
    await viewButton.first().click();
    await waitForWarehouseCanvas(page);
  }
}

async function selectFloorById(page: Page, floorId: string) {
  const siteSelect = page.getByLabel('Site');
  const floorSelect = page.getByLabel('Floor');

  await expect(siteSelect).not.toHaveValue('', { timeout: 10000 });
  await expect(floorSelect).toBeEnabled({ timeout: 10000 });
  await expect(floorSelect).toContainText('DL1', { timeout: 10000 });
  await floorSelect.selectOption(floorId);
  await expect(floorSelect).toHaveValue(floorId, { timeout: 10000 });
}

async function prepareWarehouseEditor(
  page: Page,
  floorId: string,
  flags: DiagnosticsFlags | null
) {
  await page.goto('/warehouse');
  await setDiagnosticsFlags(page, flags);
  await selectFloorById(page, floorId);
  await waitForWarehouseCanvas(page);
  await switchToViewMode(page);
}

async function samplePan(page: Page, durationMs: number) {
  const box = await getCanvasBox(page);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const deadline = Date.now() + durationMs;

  while (Date.now() < deadline) {
    await page.mouse.move(centerX, centerY);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(centerX + 220, centerY + 55, { steps: 20 });
    await page.mouse.move(centerX - 220, centerY - 55, { steps: 20 });
    await page.mouse.up({ button: 'middle' });
  }
}

async function sampleZoom(page: Page, durationMs: number) {
  const box = await getCanvasBox(page);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const deadline = Date.now() + durationMs;

  await page.mouse.move(centerX, centerY);
  while (Date.now() < deadline) {
    await page.mouse.wheel(0, -360);
    await page.waitForTimeout(50);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(50);
  }
}

async function sampleSelect(page: Page, durationMs: number) {
  const box = await getCanvasBox(page);
  const points = [
    { x: box.x + box.width * 0.34, y: box.y + box.height * 0.36 },
    { x: box.x + box.width * 0.52, y: box.y + box.height * 0.42 },
    { x: box.x + box.width * 0.66, y: box.y + box.height * 0.58 }
  ];
  const deadline = Date.now() + durationMs;
  let index = 0;

  while (Date.now() < deadline) {
    const point = points[index % points.length] as { x: number; y: number };
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(80);
    index += 1;
  }
}

async function sampleHover(page: Page, durationMs: number) {
  const box = await getCanvasBox(page);
  const points = [
    { x: box.x + box.width * 0.22, y: box.y + box.height * 0.25 },
    { x: box.x + box.width * 0.78, y: box.y + box.height * 0.25 },
    { x: box.x + box.width * 0.78, y: box.y + box.height * 0.72 },
    { x: box.x + box.width * 0.22, y: box.y + box.height * 0.72 }
  ];
  const deadline = Date.now() + durationMs;
  let index = 0;

  while (Date.now() < deadline) {
    const from = points[index % points.length] as { x: number; y: number };
    const to = points[(index + 1) % points.length] as { x: number; y: number };
    await page.mouse.move(from.x, from.y);
    await page.mouse.move(to.x, to.y, { steps: 24 });
    index += 1;
  }
}

async function getBrowserEnvironment(page: Page): Promise<BrowserEnvironment> {
  return page.evaluate(() => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory:
      'deviceMemory' in navigator
        ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
        : undefined,
    devicePixelRatio: window.devicePixelRatio
  }));
}

async function runMeasuredScenario({
  floorId,
  flags,
  page,
  profile,
  runtimeOptions,
  scenario
}: {
  floorId: string;
  flags: DiagnosticsFlags | null;
  page: Page;
  profile: DeviceProfile;
  runtimeOptions?: VariantRuntimeOptions;
  scenario: ScenarioName;
}) {
  await page.setViewportSize(profile.viewport);
  await setVariantRuntimeOptions(page, runtimeOptions);

  if (scenario === 'route-preview') {
    await page.goto('/warehouse');
    await setDiagnosticsFlags(page, flags);
    await setVariantRuntimeOptions(page, runtimeOptions);
    const browserEnvironment = await getBrowserEnvironment(page);
    await startRenderPipelineProbe(page);
    await startFrameProbe(page);
    await page.evaluate((url) => {
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/warehouse/view?floor=${floorId}`);
    await waitForWarehouseCanvas(page);
    if (runtimeOptions?.disableRackLayerHitGraph) {
      await setRackLayerHitGraphDisabled(page, true);
    }
    await startKonvaPipelineProbe(page);
    const rawResult = await stopFrameProbe(page);
    const renderPipeline = await stopRenderPipelineProbe(page);
    const konvaPipeline = await stopKonvaPipelineProbe(page);
    if (runtimeOptions?.disableRackLayerHitGraph) {
      await setRackLayerHitGraphDisabled(page, false);
    }
    const cullingMetrics = await getCanvasCullingMetrics(page);
    await setVariantRuntimeOptions(page, undefined);
    return {
      ...summarizeMetrics(rawResult),
      browserEnvironment,
      cullingMetrics,
      konvaPipeline,
      renderPipeline
    };
  }

  if (scenario === 'load') {
    await page.goto('/warehouse');
    await setDiagnosticsFlags(page, flags);
    await setVariantRuntimeOptions(page, runtimeOptions);
    const browserEnvironment = await getBrowserEnvironment(page);
    await startRenderPipelineProbe(page);
    await startFrameProbe(page);
    await selectFloorById(page, floorId);
    await waitForWarehouseCanvas(page);
    if (runtimeOptions?.disableRackLayerHitGraph) {
      await setRackLayerHitGraphDisabled(page, true);
    }
    await startKonvaPipelineProbe(page);
    const rawResult = await stopFrameProbe(page);
    const renderPipeline = await stopRenderPipelineProbe(page);
    const konvaPipeline = await stopKonvaPipelineProbe(page);
    if (runtimeOptions?.disableRackLayerHitGraph) {
      await setRackLayerHitGraphDisabled(page, false);
    }
    const cullingMetrics = await getCanvasCullingMetrics(page);
    await setVariantRuntimeOptions(page, undefined);
    return {
      ...summarizeMetrics(rawResult),
      browserEnvironment,
      cullingMetrics,
      konvaPipeline,
      renderPipeline
    };
  }

  await prepareWarehouseEditor(page, floorId, flags);
  await setVariantRuntimeOptions(page, runtimeOptions);
  const browserEnvironment = await getBrowserEnvironment(page);
  if (scenario === 'pan' && runtimeOptions?.rackLayerListeningOffDuringPan) {
    await setRackLayerListening(page, false);
  }
  if (runtimeOptions?.disableRackLayerHitGraph) {
    await setRackLayerHitGraphDisabled(page, true);
  }
  await startRenderPipelineProbe(page);
  await startKonvaPipelineProbe(page);
  await startFrameProbe(page);

  if (scenario === 'pan') {
    await samplePan(page, SAMPLE_DURATION_MS);
  } else if (scenario === 'zoom') {
    await sampleZoom(page, SAMPLE_DURATION_MS);
  } else if (scenario === 'select') {
    await sampleSelect(page, SAMPLE_DURATION_MS);
  } else if (scenario === 'hover') {
    await sampleHover(page, SAMPLE_DURATION_MS);
  }

  const rawResult = await stopFrameProbe(page);
  const renderPipeline = await stopRenderPipelineProbe(page);
  const konvaPipeline = await stopKonvaPipelineProbe(page);
  if (scenario === 'pan' && runtimeOptions?.rackLayerListeningOffDuringPan) {
    await setRackLayerListening(page, true);
  }
  if (runtimeOptions?.disableRackLayerHitGraph) {
    await setRackLayerHitGraphDisabled(page, false);
  }
  const cullingMetrics = await getCanvasCullingMetrics(page);
  await setVariantRuntimeOptions(page, undefined);
  return {
    ...summarizeMetrics(rawResult),
    browserEnvironment,
    cullingMetrics,
    konvaPipeline,
    renderPipeline
  };
}

function findEntry(
  entries: ReportEntry[],
  variant: string,
  profileName = 'native-desktop'
) {
  return (
    entries.find(
      (entry) =>
        entry.variant === variant && entry.profile.name === profileName
    ) ??
    entries.find((entry) => entry.variant === variant) ??
    null
  );
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined) return 'n/a';
  return value > 0 ? `+${value}` : String(value);
}

function summarizeChangedKeys(metrics: RenderComponentMetrics) {
  return Object.entries(metrics.changedKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => `${key}:${count}`)
    .join(', ');
}

function componentRenderLine(
  name: keyof RenderPipelineDiagnostics['components'],
  diagnostics: RenderPipelineDiagnostics
) {
  const metrics = diagnostics.components[name];
  const changedKeys = summarizeChangedKeys(metrics);
  return `${name} renders: ${metrics.renders} (state updates: ${metrics.causes.stateUpdates}, props changes: ${metrics.causes.propsChanges}, parent re-render: ${metrics.causes.parentRerenders}${changedKeys ? `, top changes: ${changedKeys}` : ''})`;
}

function formatSourceBreakdown(probe: KonvaPipelineProbeResult) {
  return Object.entries(probe.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `- ${source}: ${count}`)
    .join('\n');
}

function formatLayerScope(probe: KonvaPipelineProbeResult) {
  return probe.layers
    .map(
      (layer) =>
        `- ${layer.name}: batchDraw=${layer.batchDrawCalls}, draw=${layer.drawCalls}, drawScene=${layer.drawSceneCalls}, drawHit=${layer.drawHitCalls}, getIntersection=${layer.getIntersectionCalls}, listening=${layer.listening}`
    )
    .join('\n');
}

function formatTraceSamples(probe: KonvaPipelineProbeResult) {
  return probe.traces
    .filter((trace) => trace.events.length > 0)
    .slice(0, 10)
    .map((trace) => {
      const lines = trace.events
        .slice(0, 30)
        .map((event) => {
          const layer = event.layerName ? ` layer=${event.layerName}` : '';
          const detail = event.detail ? ` ${event.detail}` : '';
          return `  ${event.index}. ${event.name} [${event.source}]${layer}${detail}`;
        })
        .join('\n');
      return `Trace ${trace.traceId}:\n${lines}`;
    })
    .join('\n\n');
}

function metricComparisonLine(
  label: string,
  entry: ReportEntry | null,
  baseline: ReportEntry | null
) {
  if (!entry) return `${label}: not recorded`;
  const delta =
    baseline && entry !== baseline
      ? `, p95Delta=${formatDelta(entry.metrics.p95FrameMs - baseline.metrics.p95FrameMs)}, batchDrawDelta=${formatDelta(entry.konvaPipeline.layerBatchDrawCalls - baseline.konvaPipeline.layerBatchDrawCalls)}, longTaskDelta=${formatDelta(entry.metrics.longTaskCount - baseline.metrics.longTaskCount)}`
      : '';
  return `${label}: p95FrameMs=${entry.metrics.p95FrameMs}, worstFrameMs=${entry.metrics.worstFrameMs}, longTaskCount=${entry.metrics.longTaskCount}, longTaskTotalMs=${entry.metrics.longTaskTotalMs}, Stage.batchDraw=${entry.konvaPipeline.stageBatchDrawCalls}, Layer.batchDraw=${entry.konvaPipeline.layerBatchDrawCalls}, draw=${entry.konvaPipeline.layerDrawCalls}, drawScene=${entry.konvaPipeline.drawSceneCalls}, drawSceneCost=${entry.konvaPipeline.drawSceneTotalMs}, drawHit=${entry.konvaPipeline.drawHitCalls}, drawHitCost=${entry.konvaPipeline.drawHitTotalMs}${delta}`;
}

function drawCost(
  probe: KonvaPipelineProbeResult,
  bucket: 'Text' | 'Rect' | 'Group' | 'Lines / Shapes' | 'Other'
) {
  return probe.nodeSceneDrawCostBuckets[bucket]?.totalMs ?? 0;
}

const RECT_CATEGORY_LABELS = [
  'rack background / body',
  'rack sections',
  'cell base rectangles',
  'cell overlays (truth/outline/halo)',
  'selection / highlight rectangles',
  'hit/interaction rectangles',
  'badges / decorations',
  'unknown'
] as const;

type RectCategoryLabel = (typeof RECT_CATEGORY_LABELS)[number];

function categorizeRectRole(role: string): RectCategoryLabel {
  if (role === 'rack-body') return 'rack background / body';
  if (role === 'rack-section') return 'rack sections';
  if (role === 'cell-base') return 'cell base rectangles';
  if (
    role === 'cell-truth-overlay' ||
    role === 'cell-outline-overlay' ||
    role === 'cell-halo-overlay'
  ) {
    return 'cell overlays (truth/outline/halo)';
  }
  if (role === 'selection-highlight') return 'selection / highlight rectangles';
  if (role === 'cell-interaction' || role === 'rack-interaction') {
    return 'hit/interaction rectangles';
  }
  if (role === 'cell-badge' || role === 'badge-decoration') {
    return 'badges / decorations';
  }
  return 'unknown';
}

function emptyRectStyleCounters(): KonvaRectRoleStyleCounters {
  return {
    nodes: 0,
    fillEnabled: 0,
    strokeEnabled: 0,
    opacityLt1: 0,
    shadowEnabled: 0,
    dashEnabled: 0,
    listeningTrue: 0,
    hitGraphEligible: 0,
    strokeWidths: {}
  };
}

function mergeRectStyleCounters(
  target: KonvaRectRoleStyleCounters,
  source: KonvaRectRoleStyleCounters
) {
  target.nodes += source.nodes;
  target.fillEnabled += source.fillEnabled;
  target.strokeEnabled += source.strokeEnabled;
  target.opacityLt1 += source.opacityLt1;
  target.shadowEnabled += source.shadowEnabled;
  target.dashEnabled += source.dashEnabled;
  target.listeningTrue += source.listeningTrue;
  target.hitGraphEligible += source.hitGraphEligible;
  for (const [width, count] of Object.entries(source.strokeWidths)) {
    target.strokeWidths[width] = (target.strokeWidths[width] ?? 0) + count;
  }
}

function summarizeRectCategories(probe: KonvaPipelineProbeResult) {
  const result = Object.fromEntries(
    RECT_CATEGORY_LABELS.map((category) => [
      category,
      {
        count: 0,
        calls: 0,
        totalMs: 0,
        avgMsPerNode: 0,
        avgMsPerCall: 0,
        p95Ms: 0,
        maxMs: 0,
        style: emptyRectStyleCounters(),
        roles: {} as Record<
          string,
          {
            count: number;
            totalMs: number;
          }
        >
      }
    ])
  ) as Record<
    RectCategoryLabel,
    {
      count: number;
      calls: number;
      totalMs: number;
      avgMsPerNode: number;
      avgMsPerCall: number;
      p95Ms: number;
      maxMs: number;
      style: KonvaRectRoleStyleCounters;
      roles: Record<string, { count: number; totalMs: number }>;
    }
  >;

  for (const [role, style] of Object.entries(
    probe.rectNodeCompositionByRole
  )) {
    const category = categorizeRectRole(role);
    result[category].count += style.nodes;
    mergeRectStyleCounters(result[category].style, style);
    result[category].roles[role] = {
      count: style.nodes,
      totalMs: 0
    };
  }

  for (const [role, cost] of Object.entries(probe.rectSceneDrawCostByRole)) {
    const category = categorizeRectRole(role);
    const categoryResult = result[category];
    categoryResult.calls += cost.calls;
    categoryResult.totalMs += cost.totalMs;
    categoryResult.maxMs = Math.max(categoryResult.maxMs, cost.maxMs);
    categoryResult.p95Ms = Math.max(categoryResult.p95Ms, cost.p95Ms);
    categoryResult.roles[role] = {
      count: categoryResult.roles[role]?.count ?? 0,
      totalMs: round(cost.totalMs)
    };
  }

  for (const category of RECT_CATEGORY_LABELS) {
    const item = result[category];
    item.totalMs = round(item.totalMs);
    item.avgMsPerNode = item.count > 0 ? round(item.totalMs / item.count) : 0;
    item.avgMsPerCall = item.calls > 0 ? round(item.totalMs / item.calls) : 0;
    item.p95Ms = round(item.p95Ms);
    item.maxMs = round(item.maxMs);
  }

  return result;
}

function formatRectCategoryBreakdown(probe: KonvaPipelineProbeResult) {
  const categories = summarizeRectCategories(probe);
  return RECT_CATEGORY_LABELS.map((category) => {
    const item = categories[category];
    const strokeWidths = Object.entries(item.style.strokeWidths)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([width, count]) => `${width}:${count}`)
      .join(', ');
    const roles = Object.entries(item.roles)
      .sort((a, b) => b[1].totalMs - a[1].totalMs)
      .map(([role, roleSummary]) => `${role}=${roleSummary.count} nodes/${roleSummary.totalMs}ms`)
      .join('; ');
    return `| ${category} | ${item.count} | ${item.totalMs} | ${item.avgMsPerNode} | ${item.avgMsPerCall} | fill=${item.style.fillEnabled}, stroke=${item.style.strokeEnabled}, opacity<1=${item.style.opacityLt1}, shadow=${item.style.shadowEnabled}, dash=${item.style.dashEnabled}, listening=${item.style.listeningTrue}, hit=${item.style.hitGraphEligible}, strokeWidths={${strokeWidths || 'none'}} | ${roles || '-'} |`;
  }).join('\n');
}

function formatTopRectContributors(probe: KonvaPipelineProbeResult) {
  return Object.entries(summarizeRectCategories(probe))
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(
      ([category, item], index) =>
        `${index + 1}. ${category} -> ${item.totalMs} ms total (${item.count} nodes, avg ${item.avgMsPerNode} ms/node)`
    )
    .join('\n');
}

function formatRectVariantComparison(entries: ReportEntry[]) {
  return entries
    .map((entry) => {
      const rectTotal =
        entry.konvaPipeline.nodeSceneDrawCostBuckets.Rect?.totalMs ?? 0;
      const categories = summarizeRectCategories(entry.konvaPipeline);
      const categorySummary = Object.entries(categories)
        .filter(([, value]) => value.count > 0 || value.totalMs > 0)
        .sort((a, b) => b[1].totalMs - a[1].totalMs)
        .map(([category, value]) => `${category}: ${value.count}/${value.totalMs}ms`)
        .join('; ');
      return `- ${entry.variant}: Rect nodes=${entry.konvaPipeline.rackLayerComposition.byType.Rect ?? 0}, Rect draw=${rectTotal}ms, drawScene=${entry.konvaPipeline.drawSceneTotalMs}ms, drawHit=${entry.konvaPipeline.drawHitTotalMs}ms; ${categorySummary}`;
    })
    .join('\n');
}

function recommendedRectFix(entries: ReportEntry[], baseline: ReportEntry) {
  const baselineCategories = summarizeRectCategories(baseline.konvaPipeline);
  const topCategory = Object.entries(baselineCategories).sort(
    (a, b) => b[1].totalMs - a[1].totalMs
  )[0];
  const noOverlays = findEntry(entries, 'no-overlays');
  const overlayDrop =
    noOverlays && baseline
      ? round(
          (baseline.konvaPipeline.nodeSceneDrawCostBuckets.Rect?.totalMs ?? 0) -
            (noOverlays.konvaPipeline.nodeSceneDrawCostBuckets.Rect?.totalMs ?? 0)
        )
      : 0;

  if (topCategory?.[0] === 'cell base rectangles') {
    return `Merge cell base rectangles into one custom Konva Shape per visible rack/face batch. Expected impact is highest because the measured top Rect category is cell base rectangles at ${topCategory[1].totalMs}ms; the no-overlays variant shows removing per-cell surface strokes drops total Rect draw by ${overlayDrop}ms, but a Shape batch preserves the current surface/stroke UX instead of deleting it.`;
  }

  if (topCategory?.[0] === 'cell overlays (truth/outline/halo)') {
    return `Merge cell overlay rectangles into one custom Konva Shape per visible rack/face batch. Expected impact is to remove the dominant overlay Rect draw loop while preserving the same truth/outline/halo semantics; the no-overlays variant measured a Rect draw drop of ${overlayDrop}ms versus production-culling.`;
  }

  return `Merge the dominant Rect category (${topCategory?.[0] ?? 'unknown'}) into a custom Shape batch. This keeps behavior local and reversible while replacing many per-node Rect drawScene calls with one canvas loop.`;
}

function formatExperimentLine(
  label: string,
  entry: ReportEntry | null,
  baseline: ReportEntry | null
) {
  if (!entry) return `- ${label}: not recorded`;
  const p95Delta =
    baseline && entry !== baseline
      ? `, p95Delta=${formatDelta(round(entry.metrics.p95FrameMs - baseline.metrics.p95FrameMs))}`
      : '';
  const hitGraphNote =
    label === 'no hit graph' && entry.konvaPipeline.drawHitCalls !== 0
      ? ', hit graph still invoked'
      : '';
  return `- ${label}: p95FrameMs=${entry.metrics.p95FrameMs}, longTaskCount=${entry.metrics.longTaskCount}, drawSceneCost=${entry.konvaPipeline.drawSceneTotalMs}, drawHit=${entry.konvaPipeline.drawHitCalls}${p95Delta}${hitGraphNote}`;
}

function recommendHighestImpactFix(entries: ReportEntry[], baseline: ReportEntry) {
  const candidates = [
    ['labels-off', 'Reduce or virtualize Konva Text rendering first.'],
    ['no-overlays', 'Collapse overlay/highlight/stroke rendering into fewer rack/cell primitives first.'],
    ['no-hit-graph', 'Keep the rack layer non-listening during pan and use geometric hit resolution outside the hot draw path.'],
    [
      'fast-layer',
      'Split the rack visuals into a non-interactive visual layer and keep only minimal interaction geometry on a normal Layer.'
    ]
  ] as const;
  const best = candidates
    .map(([variant, fix]) => {
      const entry = findEntry(entries, variant);
      return entry
        ? {
            variant,
            fix,
            improvement: baseline.metrics.p95FrameMs - entry.metrics.p95FrameMs
          }
        : null;
    })
    .filter(
      (
        item
      ): item is {
        variant: string;
        fix: string;
        improvement: number;
      } => item !== null
    )
    .sort((a, b) => b.improvement - a.improvement)[0];

  if (!best || best.improvement <= 0) {
    return 'Use the largest measured node-type draw-cost bucket as the first optimization target; no experiment improved p95FrameMs versus normal in this run.';
  }

  return `${best.fix} This is based on ${best.variant} improving p95FrameMs by ${round(best.improvement)}ms versus normal.`;
}

function buildRenderPipelineMarkdown(
  scenario: ScenarioName,
  entries: ReportEntry[]
) {
  const production = findEntry(entries, 'production-culling');
  const manualOff = findEntry(entries, 'manual-pan-batchdraw-off');
  const rackListeningOff = findEntry(
    entries,
    'rack-layer-listening-off-during-pan'
  );
  const hitTestOff = findEntry(entries, 'hit-test-off');
  const labelsOff = findEntry(entries, 'labels-off');
  const noOverlays = findEntry(entries, 'no-overlays');
  const noHitGraph = findEntry(entries, 'no-hit-graph');
  const fastLayer = findEntry(entries, 'fast-layer');
  const unculled = findEntry(entries, 'unculled-baseline');
  if (!production) {
    return '# DL1 Draw Cost Analysis\n\nNo production-culling baseline entry was recorded.';
  }

  const diagnostics = production.renderPipeline;
  const konvaProbe = production.konvaPipeline;
  const drawCalls =
    diagnostics.konva.layerDrawCalls + diagnostics.konva.layerBatchDrawCalls;
  const hitP95Delta =
    hitTestOff && production
      ? round(hitTestOff.metrics.p95FrameMs - production.metrics.p95FrameMs)
      : null;
  const hitLongTaskDelta =
    hitTestOff && production
      ? hitTestOff.metrics.longTaskCount - production.metrics.longTaskCount
      : null;
  const labelP95Delta =
    labelsOff && production
      ? round(labelsOff.metrics.p95FrameMs - production.metrics.p95FrameMs)
      : null;
  const labelLongTaskDelta =
    labelsOff && production
      ? labelsOff.metrics.longTaskCount - production.metrics.longTaskCount
      : null;
  const cullingExplanation =
    production.cellsCulled > 0
      ? `Culling removed ${production.cellsCulled} of ${production.cellsTotal} cells.`
      : 'Culling did not remove cells in this measured viewport/level.';
  const panClassification =
    scenario !== 'pan'
      ? 'Not classified in this scenario; pan classification is based on pan samples only.'
      : diagnostics.offsetUpdates > 0 &&
          diagnostics.components.EditorCanvas.renders > 0 &&
          diagnostics.components.RackLayer.renders > 0 &&
          drawCalls > 0
        ? `React-driven: ${diagnostics.offsetUpdates} offset updates correlated with ${diagnostics.components.EditorCanvas.renders} EditorCanvas renders, ${diagnostics.components.RackLayer.renders} RackLayer renders, ${diagnostics.components.RackCells.renders} RackCells renders, and ${drawCalls} rack-layer draw/batchDraw calls.`
        : diagnostics.offsetUpdates === 0 &&
            diagnostics.components.EditorCanvas.renders === 0 &&
            diagnostics.components.RackLayer.renders === 0
          ? 'Transform-only: no offset updates or React component renders were recorded during the pan sample.'
          : `Mixed/needs review: offset updates=${diagnostics.offsetUpdates}, EditorCanvas renders=${diagnostics.components.EditorCanvas.renders}, RackLayer renders=${diagnostics.components.RackLayer.renders}, RackCells renders=${diagnostics.components.RackCells.renders}, draw calls=${drawCalls}.`;
  const rootCauses = [
    konvaProbe.autoDrawEnabled === true
      ? `Konva autoDrawEnabled was true and Node._requestDraw ran ${konvaProbe.nodeRequestDrawCalls} times during pan.`
      : `Konva autoDrawEnabled was ${String(konvaProbe.autoDrawEnabled)}; draw scheduling must be interpreted with that setting.`,
    manualOff
      ? `Manual batchDraw-off changed layer batchDraw by ${formatDelta(manualOff.konvaPipeline.layerBatchDrawCalls - konvaProbe.layerBatchDrawCalls)} and p95FrameMs by ${formatDelta(manualOff.metrics.p95FrameMs - production.metrics.p95FrameMs)}.`
      : 'Manual batchDraw-off A/B variant was not recorded.',
    production.metrics.longTaskCount > 0
      ? `Main thread long tasks were present: ${production.metrics.longTaskCount} tasks totaling ${production.metrics.longTaskTotalMs}ms.`
      : 'No main-thread long tasks were recorded.'
  ];
  const manualOffImproved =
    !!manualOff &&
    manualOff.metrics.p95FrameMs < production.metrics.p95FrameMs &&
    manualOff.konvaPipeline.layerBatchDrawCalls <
      production.konvaPipeline.layerBatchDrawCalls;
  const recommendedFirstFix = manualOffImproved
    ? 'Remove the manual pan RAF layer.batchDraw() path and rely on Konva autoDraw for stage.position(), guarded behind the same diagnostics flag for rollout validation.'
    : 'Do not remove manual pan batchDraw yet; the measured A/B result did not prove it reduces both batchDraw count and p95 frame time.';
  const composition = konvaProbe.rackLayerComposition;
  const textDrawCost = drawCost(konvaProbe, 'Text');
  const rectDrawCost = drawCost(konvaProbe, 'Rect');
  const groupDrawCost = drawCost(konvaProbe, 'Group');
  const linesShapesDrawCost = drawCost(konvaProbe, 'Lines / Shapes');
  const otherDrawCost = drawCost(konvaProbe, 'Other');
  const textDominant =
    textDrawCost >
    Math.max(rectDrawCost, groupDrawCost, linesShapesDrawCost, otherDrawCost);
  const overlayDominant =
    !!noOverlays &&
    noOverlays.metrics.p95FrameMs < production.metrics.p95FrameMs;
  const overlayP95Drop = noOverlays
    ? round(production.metrics.p95FrameMs - noOverlays.metrics.p95FrameMs)
    : 0;
  const fastLayerDiagnosticNote =
    fastLayer
      ? 'FastLayer is diagnostic-only; do not keep it as production behavior unless interaction tradeoffs are explicitly handled.'
      : 'FastLayer diagnostic was not recorded.';
  const topRectCategory = Object.entries(
    summarizeRectCategories(konvaProbe)
  ).sort((a, b) => b[1].totalMs - a[1].totalMs)[0];

  return `# DL1 Draw Cost Analysis

## Node Composition
Text nodes: ${composition.byType.Text ?? 0}
Rect nodes: ${composition.byType.Rect ?? 0}
Group nodes: ${composition.byType.Group ?? 0}
Total: ${composition.total}

By type: ${JSON.stringify(composition.byType)}
listening=true nodes: ${composition.listeningTrue}
hit-graph eligible nodes: ${composition.hitGraphEligible}

## Cost Breakdown
Text draw cost: ${textDrawCost} ms
Rect draw cost: ${rectDrawCost} ms
Group draw cost: ${groupDrawCost} ms
Lines / Shapes draw cost: ${linesShapesDrawCost} ms
Other: ${otherDrawCost} ms

Node draw cost by type: ${JSON.stringify(konvaProbe.nodeSceneDrawCostByType)}

## Rect Cost Breakdown
| category | count | total ms | avg ms/node | avg ms/call | style counters | roles |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${formatRectCategoryBreakdown(konvaProbe)}

## Top Rect Contributors
${formatTopRectContributors(konvaProbe)}

## Variant Comparison
${formatRectVariantComparison(entries)}

## Experiments
${formatExperimentLine('normal', production, production)}
${formatExperimentLine('no text', labelsOff, production)}
${formatExperimentLine('no overlays', noOverlays, production)}
${formatExperimentLine('no hit graph', noHitGraph, production)}
${formatExperimentLine('FastLayer', fastLayer, production)}
${fastLayerDiagnosticNote}

## Root Cause
1. ${textDominant ? `Text is the largest exclusive node draw-cost bucket at ${textDrawCost}ms.` : `The largest exclusive node draw-cost bucket is Rect at ${rectDrawCost}ms; top Rect category is ${topRectCategory?.[0] ?? 'unknown'} at ${topRectCategory?.[1].totalMs ?? 0}ms.`}
2. ${overlayDominant ? `Overlay/highlight/stroke removal improved p95FrameMs by ${overlayP95Drop}ms and reduced Rect draw cost, but the role table identifies which Rect category owns that cost.` : 'Overlay removal did not show a p95FrameMs win in the recorded run, or the variant was not recorded.'}
3. drawScene dominates the measured Konva work: drawSceneCost=${konvaProbe.drawSceneTotalMs}ms, drawHitCost=${konvaProbe.drawHitTotalMs}ms.

## Recommended Fix
${recommendedRectFix(entries, production)}

Secondary experiment ranking: ${recommendHighestImpactFix(entries, production)}

## Konva Pipeline Detail

## BatchDraw Sources
Stage.batchDraw calls: ${konvaProbe.stageBatchDrawCalls}
Layer.batchDraw calls: ${konvaProbe.layerBatchDrawCalls}
Node._requestDraw calls: ${konvaProbe.nodeRequestDrawCalls}

${formatSourceBreakdown(konvaProbe)}

## Ordered Pan Frame Traces
${formatTraceSamples(konvaProbe) || 'No trace samples recorded.'}

## AutoDraw / Coalescing Behavior
Konva.autoDrawEnabled: ${String(konvaProbe.autoDrawEnabled)}
Stage.getAttr('autoDrawEnabled'): ${String(konvaProbe.stageAutoDrawAttr)}
Layer.batchDraw details include _waitingForDraw. Calls with _waitingForDraw=true were already coalesced by Konva and did not schedule a second draw for that layer RAF.

## Stage Movement Behavior
stage.position calls: ${konvaProbe.stagePositionCalls}
Node._requestDraw calls: ${konvaProbe.nodeRequestDrawCalls}
Stage.batchDraw calls: ${konvaProbe.stageBatchDrawCalls}
drawScene calls: ${konvaProbe.drawSceneCalls}
drawHit calls: ${konvaProbe.drawHitCalls}

## Layer Scope
${formatLayerScope(konvaProbe)}

## Node Composition
Total rack-layer nodes: ${konvaProbe.rackLayerComposition.total}
By type: ${JSON.stringify(konvaProbe.rackLayerComposition.byType)}
listening=true nodes: ${konvaProbe.rackLayerComposition.listeningTrue}
hit-graph eligible nodes: ${konvaProbe.rackLayerComposition.hitGraphEligible}

## Interaction Cost
${metricComparisonLine('normal', production, production)}
${metricComparisonLine('rack-layer-listening-off-during-pan', rackListeningOff, production)}
${metricComparisonLine('hit-test-off', hitTestOff, production)}
Pointer move calls: ${konvaProbe.pointerMoveCalls}
Pointer enter/leave calls: ${konvaProbe.pointerEnterLeaveCalls}
getIntersection calls: ${konvaProbe.getIntersectionCalls}

## RAF Loop Analysis
${metricComparisonLine('A current manual RAF + stage.position', production, production)}
${metricComparisonLine('B manual RAF disabled, only stage.position', manualOff, production)}
Conclusion: ${manualOff ? 'Measured by direct A/B comparison.' : 'manual-pan-batchdraw-off variant was not recorded.'}

## React Rendering Context
${componentRenderLine('EditorCanvas', diagnostics)}
${componentRenderLine('RackLayer', diagnostics)}
${componentRenderLine('RackCells', diagnostics)}

## Existing Konva Rendering Counters
Layer draw calls: ${diagnostics.konva.layerDrawCalls}
Layer batchDraw calls: ${diagnostics.konva.layerBatchDrawCalls}
Konva node count: ${diagnostics.konva.rackLayerNodeCount}

## Pan Architecture
${panClassification}

Camera/store updates: ${diagnostics.cameraStoreUpdates}
Offset updates: ${diagnostics.offsetUpdates}
Zoom camera updates: ${diagnostics.zoomCameraUpdates}

## Hit Test Impact
p95FrameMs difference: ${formatDelta(hitP95Delta)}
longTaskCount difference: ${formatDelta(hitLongTaskDelta)}
Conclusion: ${hitTestOff ? 'Measured by comparing production-culling with hit-test-off.' : 'hit-test-off variant was not recorded.'}

## Label Impact
p95FrameMs difference: ${formatDelta(labelP95Delta)}
longTaskCount difference: ${formatDelta(labelLongTaskDelta)}
Conclusion: ${labelsOff ? `Measured for ${scenario} by comparing production-culling with labels-off.` : 'labels-off variant was not recorded.'}

## Culling Effectiveness
cellsTotal: ${production.cellsTotal}
cellsRendered: ${production.cellsRendered}
cellsCulled: ${production.cellsCulled}
cullingRatio: ${production.cullingRatio}
${cullingExplanation}
${unculled ? `Unculled p95FrameMs delta: ${formatDelta(unculled.deltaVsProductionCulling?.p95FrameMsDelta)}` : 'Unculled baseline was not recorded.'}

## Main Thread Analysis
longTaskCount: ${production.metrics.longTaskCount}
longTaskTotalMs: ${production.metrics.longTaskTotalMs}
worstFrameMs: ${production.metrics.worstFrameMs}
Conclusion: ${production.metrics.longTaskCount > 0 ? 'Frames include JS main-thread blocking.' : 'No long-task evidence of JS main-thread blocking in this run.'}

## Root Cause
1. ${rootCauses[0]}
2. ${rootCauses[1]}
3. ${rootCauses[2]}

## Recommended First Fix
- ${recommendedFirstFix}`;
}

test.describe('DL1 diagnostics harness', () => {
  test.setTimeout(
    Math.max(
      600000,
      SAMPLE_DURATION_MS *
        selectedProfiles.length *
        selectedVariants.length *
        12
    )
  );

  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  for (const scenario of selectedScenarios) {
    test(`dl1:${scenario} records report-only diagnostics`, async ({
      browser
    }, testInfo) => {
      const { floor, layoutVersionId } = await seedExplicitDraftScenario({
        siteCode: `PERF_${scenario.replace('-', '_').toUpperCase()}`,
        siteName: `Performance ${scenario} Site`,
        floorCode: 'DL1',
        floorName: 'Demo Layout Floor',
        racks: buildDemoWarehouseRackPayloads()
      });
      const context = await browser.newContext();
      const entries: ReportEntry[] = [];
      const baselineByProfile = new Map<DeviceProfile['name'], Metrics>();

      try {
        await installDiagnosticsInitScript(context);
        for (const profile of selectedProfiles) {
          const page = await context.newPage();
          const client = await context.newCDPSession(page);
          try {
            await client.send('Emulation.setCPUThrottlingRate', {
              rate: profile.cpuThrottleRate
            });
            await signInToWarehouse(page);

            for (const variant of selectedVariants) {
              const result = await runMeasuredScenario({
                floorId: floor.id,
                flags: variant.flags,
                page,
                profile,
                runtimeOptions: variant.runtimeOptions,
                scenario
              });
              const { budgetStatus, budgetFailures } = evaluateBudget(
                profile,
                result.metrics
              );
              const baseline = baselineByProfile.get(profile.name) ?? null;
              const deltaVsProductionCulling =
                variant.name === 'production-culling'
                  ? null
                  : summarizeDelta(result.metrics, baseline);

              if (variant.name === 'production-culling') {
                baselineByProfile.set(profile.name, result.metrics);
              }

              entries.push({
                scenario,
                variant: variant.name,
                profile,
                flags: variant.flags,
                metrics: result.metrics,
                cellsTotal: result.cullingMetrics.cellsTotal,
                cellsRendered: result.cullingMetrics.cellsRendered,
                cellsCulled: result.cullingMetrics.cellsCulled,
                cullingRatio: result.cullingMetrics.cullingRatio,
                cullingMetrics: result.cullingMetrics,
                frameBuckets: result.frameBuckets,
                budgetStatus,
                budgetFailures,
                deltaVsProductionCulling,
                deltaVsFullRender: deltaVsProductionCulling,
                renderPipeline: result.renderPipeline,
                konvaPipeline: result.konvaPipeline,
                browserEnvironment: result.browserEnvironment,
                seed: {
                  floorId: floor.id,
                  layoutVersionId,
                  expectedPreviewCellCount:
                    demoWarehouseExpectedPreviewCellCount
                }
              });
            }
          } finally {
            await client
              .send('Emulation.setCPUThrottlingRate', { rate: 1 })
              .catch(() => undefined);
            await page.close().catch(() => undefined);
          }
        }
      } finally {
        await context.close().catch(() => undefined);
      }

      const report = {
        generatedAt: new Date().toISOString(),
        sampleDurationMs: SAMPLE_DURATION_MS,
        scenario,
        renderPipelineReport: buildRenderPipelineMarkdown(scenario, entries),
        entries
      };
      const reportPath = testInfo.outputPath(
        `dl1-${scenario}-diagnostics-report.json`
      );
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, JSON.stringify(report, null, 2));
      await testInfo.attach(`dl1-${scenario}-diagnostics-report`, {
        path: reportPath,
        contentType: 'application/json'
      });

      console.table(
        entries.map((entry) => ({
          scenario: entry.scenario,
          variant: entry.variant,
          profile: entry.profile.name,
          avgFps: entry.metrics.averageFps,
          p95FrameMs: entry.metrics.p95FrameMs,
          worstFrameMs: entry.metrics.worstFrameMs,
          offsetUpdates: entry.renderPipeline.offsetUpdates,
          editorRenders:
            entry.renderPipeline.components.EditorCanvas.renders,
          rackLayerRenders:
            entry.renderPipeline.components.RackLayer.renders,
          rackCellsRenders:
            entry.renderPipeline.components.RackCells.renders,
          drawCalls:
            entry.renderPipeline.konva.layerDrawCalls +
            entry.renderPipeline.konva.layerBatchDrawCalls,
          stageBatchDraw: entry.konvaPipeline.stageBatchDrawCalls,
          layerBatchDraw: entry.konvaPipeline.layerBatchDrawCalls,
          drawScene: entry.konvaPipeline.drawSceneCalls,
          drawSceneMs: entry.konvaPipeline.drawSceneTotalMs,
          drawHit: entry.konvaPipeline.drawHitCalls,
          drawHitMs: entry.konvaPipeline.drawHitTotalMs,
          textDrawMs:
            entry.konvaPipeline.nodeSceneDrawCostBuckets.Text?.totalMs ?? 0,
          rectDrawMs:
            entry.konvaPipeline.nodeSceneDrawCostBuckets.Rect?.totalMs ?? 0,
          cullingRatio: entry.cullingRatio,
          gt100MsPct:
            entry.frameBuckets.gt100To250Ms.percent +
            entry.frameBuckets.gt250To500Ms.percent +
            entry.frameBuckets.gt500Ms.percent,
          budget: entry.budgetStatus,
          p95Delta: entry.deltaVsProductionCulling?.p95FrameMsDelta ?? null
        }))
      );

      expect(entries.length).toBe(
        selectedProfiles.length * selectedVariants.length
      );
      expect(entries.every((entry) => entry.metrics.frames > 0)).toBe(true);
      expect(
        entries.every(
          (entry) =>
            entry.variant === 'production-culling' ||
            entry.deltaVsProductionCulling !== null
        )
      ).toBe(true);
    });
  }
});
