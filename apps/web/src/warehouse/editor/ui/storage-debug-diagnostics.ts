import type Konva from 'konva';
import type { ViewMode } from '@/warehouse/editor/model/editor-types';
import {
  recordClientRuntimeCanvasSnapshot,
  type ClientRuntimeCanvasLifecycleSnapshot
} from '@/shared/diagnostics/client-runtime-diagnostics';
import type { StorageDebugFlags } from './storage-debug-flags';

type SnapshotReason =
  | 'before-entering-storage-mode'
  | 'after-entering-storage-mode'
  | 'after-entering-storage-mode:100ms'
  | 'after-entering-storage-mode:500ms'
  | 'after-entering-storage-mode:1s'
  | 'after-entering-storage-mode:2s'
  | 'leaving-storage-mode'
  | 'pagehide';

type SnapshotContext = {
  activeWarehouseMode: ViewMode;
  snapshotReason: SnapshotReason;
  currentIsolationFlags: StorageDebugFlags;
  viewport?: { width: number; height: number } | null;
  containerClientSize?: { width: number; height: number } | null;
};

const trackedStages = new Set<Konva.Stage>();
const sessionId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `storage-debug-${Date.now()}`;

let stageMountCount = 0;
let stageDestroyCount = 0;
let effectiveKonvaPixelRatio: number | null = null;
let latestViewport: { width: number; height: number } | null = null;
let latestContainerClientSize: { width: number; height: number } | null = null;

function toApproxMiB(width: number, height: number) {
  return Number(((width * height * 4) / (1024 * 1024)).toFixed(2));
}

function inferDprApplication(params: {
  stageWidth: number | null;
  effectivePixelRatio: number | null;
  primaryCanvasWidth: number | null;
}) {
  const { stageWidth, effectivePixelRatio: ratio, primaryCanvasWidth } = params;
  if (!stageWidth || !primaryCanvasWidth || !ratio || ratio <= 0) return 'unknown';

  const onceWidth = stageWidth * ratio;
  const twiceWidth = stageWidth * ratio * ratio;
  const onceDelta = Math.abs(primaryCanvasWidth - onceWidth);
  const twiceDelta = Math.abs(primaryCanvasWidth - twiceWidth);

  if (onceDelta <= 1) return 'once';
  if (twiceDelta <= 1) return 'twice';
  return 'unknown';
}

function readCanvasElements() {
  if (typeof document === 'undefined') return [];

  return Array.from(document.querySelectorAll('canvas')).map((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    approximateMiB: toApproxMiB(canvas.width, canvas.height)
  }));
}

function buildSnapshot(context: SnapshotContext): ClientRuntimeCanvasLifecycleSnapshot {
  const canvasElements = readCanvasElements();
  const trackedStageList = Array.from(trackedStages);
  const primaryStage = trackedStageList[0] ?? null;
  const primaryCanvas = canvasElements[0] ?? null;
  const viewport = context.viewport ?? latestViewport;
  const containerClientSize =
    context.containerClientSize ?? latestContainerClientSize ?? null;

  return {
    sessionId,
    timestamp: new Date().toISOString(),
    activeWarehouseMode: context.activeWarehouseMode,
    snapshotReason: context.snapshotReason,
    canvasCount: canvasElements.length,
    canvasElements,
    totalApproxCanvasMiB: Number(
      canvasElements.reduce((sum, canvas) => sum + canvas.approximateMiB, 0).toFixed(2)
    ),
    konvaStageCount: trackedStageList.length,
    konvaLayerCount: trackedStageList.reduce(
      (sum, stage) => sum + stage.getLayers().length,
      0
    ),
    stageMountCount,
    stageDestroyCount,
    currentIsolationFlags: context.currentIsolationFlags,
    effectiveKonvaPixelRatio,
    viewport: viewport
      ? {
          width: viewport.width,
          height: viewport.height
        }
      : null,
    devicePixelRatio:
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : null,
    dimensionPipeline: {
      containerClientWidth: containerClientSize?.width ?? null,
      containerClientHeight: containerClientSize?.height ?? null,
      viewportWidth: viewport?.width ?? null,
      viewportHeight: viewport?.height ?? null,
      stageWidth: primaryStage ? primaryStage.width() : null,
      stageHeight: primaryStage ? primaryStage.height() : null,
      primaryCanvasWidth: primaryCanvas?.width ?? null,
      primaryCanvasHeight: primaryCanvas?.height ?? null,
      primaryCanvasClientWidth: primaryCanvas?.clientWidth ?? null,
      primaryCanvasClientHeight: primaryCanvas?.clientHeight ?? null,
      dprApplication: inferDprApplication({
        stageWidth: primaryStage ? primaryStage.width() : null,
        effectivePixelRatio: effectiveKonvaPixelRatio,
        primaryCanvasWidth: primaryCanvas?.width ?? null
      })
    }
  };
}

export function registerStorageDebugStage(stage: Konva.Stage) {
  if (trackedStages.has(stage)) return;
  trackedStages.add(stage);
  stageMountCount += 1;
}

export function unregisterStorageDebugStage(stage: Konva.Stage) {
  if (!trackedStages.delete(stage)) return;
  stageDestroyCount += 1;
}

export function setStorageDebugEffectiveKonvaPixelRatio(pixelRatio: number) {
  effectiveKonvaPixelRatio = pixelRatio;
}

export function setStorageDebugViewportSnapshot(params: {
  viewport: { width: number; height: number } | null;
  containerClientSize: { width: number; height: number } | null;
}) {
  latestViewport = params.viewport;
  latestContainerClientSize = params.containerClientSize;
}

export function recordStorageDebugCanvasSnapshot(context: SnapshotContext) {
  recordClientRuntimeCanvasSnapshot(buildSnapshot(context));
}
