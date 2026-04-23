import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { signInToWarehouse } from '../support/auth';
import { buildDemoWarehouseRackPayloads, demoWarehouseExpectedPreviewCellCount } from '../support/demo-warehouse-layout';
import { resetWarehouseData, seedExplicitDraftScenario } from '../support/local-supabase';

const SAMPLE_DURATION_MS = Number(process.env.DL1_PERF_DURATION_MS ?? 8000);

type DeviceProfile = {
  name: string;
  cpuThrottleRate: number;
  viewport: {
    width: number;
    height: number;
  };
};

type RawProbeResult = {
  frameTimes: number[];
  longTasks: Array<{ duration: number; startTime: number; name: string }>;
  memory: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  } | null;
};

type ProfileResult = {
  profile: DeviceProfile;
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
  {
    name: 'low-end-cpu-6x',
    cpuThrottleRate: 6,
    viewport: { width: 1280, height: 720 }
  }
];

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));

  return sorted[index] ?? 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function summarizeProfile(profile: DeviceProfile, raw: RawProbeResult): ProfileResult {
  const frameTimes = raw.frameTimes.filter((value) => Number.isFinite(value) && value > 0);
  const totalFrameMs = frameTimes.reduce((sum, value) => sum + value, 0);
  const averageFrameMs = frameTimes.length > 0 ? totalFrameMs / frameTimes.length : 0;
  const p50FrameMs = percentile(frameTimes, 50);
  const p95FrameMs = percentile(frameTimes, 95);
  const worstFrameMs = frameTimes.length > 0 ? Math.max(...frameTimes) : 0;
  const longTaskTotalMs = raw.longTasks.reduce((sum, task) => sum + task.duration, 0);

  return {
    profile,
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
  };
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

        const memoryInfo = 'memory' in performance
          ? performance.memory as NonNullable<RawProbeResult['memory']>
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
    const global = window as unknown as { __dl1FrameProbe?: { stop: () => RawProbeResult } };
    const result = global.__dl1FrameProbe?.stop();
    global.__dl1FrameProbe = undefined;

    if (!result) {
      throw new Error('DL1 frame probe was not started.');
    }

    return result;
  });
}

async function waitForWarehouseCanvas(page: Page) {
  await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

async function driveCanvasInteractions(page: Page, durationMs: number) {
  const canvas = page.locator('.konvajs-content canvas').first();
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Warehouse canvas is not visible.');
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const deadline = Date.now() + durationMs;

  await page.mouse.move(centerX, centerY);

  while (Date.now() < deadline) {
    await page.mouse.down();
    await page.mouse.move(centerX + 240, centerY + 60, { steps: 18 });
    await page.mouse.move(centerX - 220, centerY - 40, { steps: 18 });
    await page.mouse.up();
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(80);
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(80);
  }
}

test.describe('DL1 warehouse canvas performance', () => {
  test.setTimeout(Math.max(120000, SAMPLE_DURATION_MS * DEVICE_PROFILES.length * 4));

  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('records FPS while panning and zooming the current DL1 seed', async ({ browserName, page }, testInfo) => {
    const { floor, layoutVersionId } = await seedExplicitDraftScenario({
      siteCode: 'PERF',
      siteName: 'Performance Site',
      floorCode: 'DL1',
      floorName: 'Demo Layout Floor',
      racks: buildDemoWarehouseRackPayloads()
    });
    const client = await page.context().newCDPSession(page);
    const profileResults: ProfileResult[] = [];

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(floor.id);
    await waitForWarehouseCanvas(page);

    const browserEnvironment = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: 'deviceMemory' in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined,
      devicePixelRatio: window.devicePixelRatio
    }));

    for (const profile of DEVICE_PROFILES) {
      await page.setViewportSize(profile.viewport);
      await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottleRate });
      await waitForWarehouseCanvas(page);

      await driveCanvasInteractions(page, 1200);
      await startFrameProbe(page);
      await driveCanvasInteractions(page, SAMPLE_DURATION_MS);
      const rawResult = await stopFrameProbe(page);
      profileResults.push(summarizeProfile(profile, rawResult));
    }

    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const report = {
      scenario: 'DL1 current demo layout seed',
      layoutVersionId,
      floorId: floor.id,
      expectedPreviewCellCount: demoWarehouseExpectedPreviewCellCount,
      browserName,
      browserEnvironment,
      generatedAt: new Date().toISOString(),
      profiles: profileResults
    };

    const reportPath = testInfo.outputPath('dl1-fps-report.json');
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach('dl1-fps-report', {
      path: reportPath,
      contentType: 'application/json'
    });

    console.table(profileResults.map((result) => ({
      profile: result.profile.name,
      avgFps: result.averageFps,
      p50Fps: result.p50Fps,
      p95FrameMs: result.p95FrameMs,
      worstFrameMs: result.worstFrameMs,
      longTasks: result.longTaskCount
    })));

    expect(profileResults).toHaveLength(DEVICE_PROFILES.length);
    expect(profileResults.every((result) => result.frames > 0)).toBe(true);
  });
});
