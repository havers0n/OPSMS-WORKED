import { env } from '@/shared/config/env';
import { createUuid } from '@/shared/lib/create-uuid';

type SerializableContext = Record<string, unknown>;

export type ClientRuntimeErrorSource =
  | 'window-error'
  | 'unhandled-rejection'
  | 'react-error-boundary'
  | 'manual-debug';

export type ClientRuntimeViewport = {
  width: number;
  height: number;
  pixelRatio: number | null;
};

export type ClientRuntimeEvent = {
  id: string;
  name: string;
  recordedAt: string;
  route: string | null;
  data: SerializableContext | null;
};

export type ClientRuntimeErrorRecord = {
  clientErrorId: string;
  source: ClientRuntimeErrorSource;
  message: string;
  stack: string | null;
  componentStack: string | null;
  route: string | null;
  url: string | null;
  userAgent: string | null;
  occurredAt: string;
  viewport: ClientRuntimeViewport | null;
  context: SerializableContext | null;
};

export type ClientRuntimeCanvasElementSnapshot = {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  approximateMiB: number;
};

export type ClientRuntimeCanvasLifecycleSnapshot = {
  sessionId: string;
  timestamp: string;
  activeWarehouseMode: string;
  snapshotReason: string;
  canvasCount: number;
  canvasElements: ClientRuntimeCanvasElementSnapshot[];
  totalApproxCanvasMiB: number;
  konvaStageCount: number;
  konvaLayerCount: number;
  stageMountCount: number;
  stageDestroyCount: number;
  currentIsolationFlags: SerializableContext | null;
  effectiveKonvaPixelRatio: number | null;
  viewport: { width: number; height: number } | null;
  devicePixelRatio: number | null;
  dimensionPipeline: {
    containerClientWidth: number | null;
    containerClientHeight: number | null;
    viewportWidth: number | null;
    viewportHeight: number | null;
    stageWidth: number | null;
    stageHeight: number | null;
    primaryCanvasWidth: number | null;
    primaryCanvasHeight: number | null;
    primaryCanvasClientWidth: number | null;
    primaryCanvasClientHeight: number | null;
    dprApplication: string;
  };
};

type ClientRuntimeDiagnosticsState = {
  currentRoute: string | null;
  lastError: ClientRuntimeErrorRecord | null;
  recentEvents: ClientRuntimeEvent[];
  recentCanvasSnapshots: ClientRuntimeCanvasLifecycleSnapshot[];
};

const STORAGE_KEY = 'wos:last-client-runtime-error';
const MAX_RECENT_EVENTS = 12;
const MAX_RECENT_CANVAS_SNAPSHOTS = 8;
const subscribers = new Set<() => void>();

let handlersInstalled = false;
let state: ClientRuntimeDiagnosticsState = {
  currentRoute: null,
  lastError: loadPersistedError(),
  recentEvents: [],
  recentCanvasSnapshots: []
};

function loadPersistedError(): ClientRuntimeErrorRecord | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientRuntimeErrorRecord;
  } catch {
    return null;
  }
}

function persistLastError(error: ClientRuntimeErrorRecord) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(error));
  } catch {
    // ignore persistence failures
  }
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function updateState(updater: (current: ClientRuntimeDiagnosticsState) => ClientRuntimeDiagnosticsState) {
  state = updater(state);
  notifySubscribers();
}

function safeSerializeContext(value: unknown): SerializableContext | null {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value)) as SerializableContext;
  } catch {
    return {
      nonSerializable: true,
      preview: String(value)
    };
  }
}

function getViewportSnapshot(): ClientRuntimeViewport | null {
  if (typeof window === 'undefined') return null;

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null
  };
}

function resolveClientErrorsUrl() {
  const baseUrl = env.bffUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/api')) {
    return `${baseUrl}/client-errors`;
  }
  return `${baseUrl}/api/client-errors`;
}

async function postClientRuntimeReport(payload: unknown) {
  try {
    await fetch(resolveClientErrorsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(payload)
    });
  } catch {
    // diagnostics must never throw
  }
}

export function subscribeClientRuntimeDiagnostics(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getClientRuntimeDiagnosticsSnapshot() {
  return state;
}

export function setClientRuntimeRoute(route: string) {
  updateState((current) => ({
    ...current,
    currentRoute: route
  }));
}

export function recordClientRuntimeEvent(name: string, data?: SerializableContext) {
  const event: ClientRuntimeEvent = {
    id: createUuid(),
    name,
    recordedAt: new Date().toISOString(),
    route: state.currentRoute,
    data: safeSerializeContext(data)
  };

  updateState((current) => ({
    ...current,
    recentEvents: [event, ...current.recentEvents].slice(0, MAX_RECENT_EVENTS)
  }));
}

export function reportClientRuntimeError({
  source,
  message,
  stack = null,
  componentStack = null,
  context = null
}: {
  source: ClientRuntimeErrorSource;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  context?: Record<string, unknown> | null;
}) {
  const error: ClientRuntimeErrorRecord = {
    clientErrorId: createUuid(),
    source,
    message,
    stack,
    componentStack,
    route: state.currentRoute,
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
    occurredAt: new Date().toISOString(),
    viewport: getViewportSnapshot(),
    context: safeSerializeContext(context)
  };

  persistLastError(error);
  updateState((current) => ({
    ...current,
    lastError: error
  }));
  void postClientRuntimeReport({
    kind: 'error',
    error
  });
  return error.clientErrorId;
}

export function recordClientRuntimeCanvasSnapshot(
  snapshot: ClientRuntimeCanvasLifecycleSnapshot
) {
  updateState((current) => ({
    ...current,
    recentCanvasSnapshots: [snapshot, ...current.recentCanvasSnapshots].slice(
      0,
      MAX_RECENT_CANVAS_SNAPSHOTS
    )
  }));

  void postClientRuntimeReport({
    kind: 'canvas-lifecycle-snapshot',
    snapshot
  });
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  return 'Unknown client runtime error';
}

export function installGlobalClientRuntimeDiagnostics() {
  if (typeof window === 'undefined' || handlersInstalled) {
    return () => undefined;
  }

  const onWindowError = (event: ErrorEvent) => {
    reportClientRuntimeError({
      source: 'window-error',
      message: event.message || errorMessageFromUnknown(event.error),
      stack: event.error instanceof Error ? event.error.stack ?? null : null,
      context: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      }
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientRuntimeError({
      source: 'unhandled-rejection',
      message: errorMessageFromUnknown(reason),
      stack: reason instanceof Error ? reason.stack ?? null : null,
      context: {
        reason: safeSerializeContext(reason)
      }
    });
  };

  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  handlersInstalled = true;

  return () => {
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    handlersInstalled = false;
  };
}

export function formatClientRuntimeDiagnosticsForClipboard(snapshot: ClientRuntimeDiagnosticsState) {
  return JSON.stringify(
    {
      route: snapshot.currentRoute,
      lastError: snapshot.lastError,
      recentEvents: snapshot.recentEvents,
      recentCanvasSnapshots: snapshot.recentCanvasSnapshots
    },
    null,
    2
  );
}
