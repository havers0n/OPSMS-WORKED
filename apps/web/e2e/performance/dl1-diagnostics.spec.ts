import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
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
  cellOverlays: 'normal' | 'surface-only';
  enableProductionCellCulling: boolean;
};

type Variant = {
  name: string;
  flags: DiagnosticsFlags | null;
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
  enableProductionCellCulling: true
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
  { name: 'labels-off', flags: { ...NORMAL_FLAGS, labels: 'off' } },
  { name: 'hit-test-off', flags: { ...NORMAL_FLAGS, hitTest: 'off' } },
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
  scenario
}: {
  floorId: string;
  flags: DiagnosticsFlags | null;
  page: Page;
  profile: DeviceProfile;
  scenario: ScenarioName;
}) {
  await page.setViewportSize(profile.viewport);

  if (scenario === 'route-preview') {
    await page.goto('/warehouse');
    await setDiagnosticsFlags(page, flags);
    const browserEnvironment = await getBrowserEnvironment(page);
    await startFrameProbe(page);
    await page.evaluate((url) => {
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/warehouse/view?floor=${floorId}`);
    await waitForWarehouseCanvas(page);
    const rawResult = await stopFrameProbe(page);
    const cullingMetrics = await getCanvasCullingMetrics(page);
    return {
      ...summarizeMetrics(rawResult),
      browserEnvironment,
      cullingMetrics
    };
  }

  if (scenario === 'load') {
    await page.goto('/warehouse');
    await setDiagnosticsFlags(page, flags);
    const browserEnvironment = await getBrowserEnvironment(page);
    await startFrameProbe(page);
    await selectFloorById(page, floorId);
    await waitForWarehouseCanvas(page);
    const rawResult = await stopFrameProbe(page);
    const cullingMetrics = await getCanvasCullingMetrics(page);
    return {
      ...summarizeMetrics(rawResult),
      browserEnvironment,
      cullingMetrics
    };
  }

  await prepareWarehouseEditor(page, floorId, flags);
  const browserEnvironment = await getBrowserEnvironment(page);
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
  const cullingMetrics = await getCanvasCullingMetrics(page);
  return { ...summarizeMetrics(rawResult), browserEnvironment, cullingMetrics };
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
