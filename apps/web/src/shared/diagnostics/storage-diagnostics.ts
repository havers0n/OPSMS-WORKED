import { createUuid } from '@/shared/lib/create-uuid';
import { env } from '@/shared/config/env';

export type StorageBreadcrumbName =
  | 'storage-mode-entered'
  | 'published-cells-fetch-started'
  | 'published-cells-loaded'
  | 'occupancy-fetch-started'
  | 'occupancy-loaded'
  | 'storage-derived-model-built'
  | 'navigator-mounted'
  | 'inspector-mounted'
  | 'occupancy-overlay-mounted';

export type StorageBreadcrumb = {
  name: StorageBreadcrumbName;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type StorageDebugFlags = {
  disableRackLayer: boolean;
  disableCanvasSceneData: boolean;
  disableOccupancyOverlay: boolean;
  disableNavigator: boolean;
  disableInspector: boolean;
  disableStorageData: boolean;
};

export type HeartbeatPayload = {
  sessionId: string;
  sequence: number;
  timestamp: string;
  route: string;
  activeWarehouseMode: string;
  floorId: string | null;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number | null;
  publishedCellCount: number;
  occupancyRowCount: number;
  navigatorItemCount: number | null;
  recentBreadcrumbs: StorageBreadcrumb[];
  activeDebugFlags: StorageDebugFlags;
  userAgent: string;
};

const MAX_BREADCRUMBS = 20;
let breadcrumbs: StorageBreadcrumb[] = [];
let breadcrumbSeq = 0;

export function parseStorageDebugFlags(search: string): StorageDebugFlags {
  const params = new URLSearchParams(search);
  return {
    disableRackLayer: params.get('disableRackLayer') === '1',
    disableCanvasSceneData: params.get('disableCanvasSceneData') === '1',
    disableOccupancyOverlay: params.get('disableOccupancyOverlay') === '1',
    disableNavigator: params.get('disableNavigator') === '1',
    disableInspector: params.get('disableInspector') === '1',
    disableStorageData: params.get('disableStorageData') === '1'
  };
}

export function recordStorageBreadcrumb(name: StorageBreadcrumbName, data?: Record<string, unknown>): void {
  breadcrumbSeq++;
  const crumb: StorageBreadcrumb = {
    name,
    timestamp: new Date().toISOString(),
    data: data ? { ...data, _seq: breadcrumbSeq } : { _seq: breadcrumbSeq }
  };
  breadcrumbs = [crumb, ...breadcrumbs].slice(0, MAX_BREADCRUMBS);
}

export function getStorageBreadcrumbs(): StorageBreadcrumb[] {
  return breadcrumbs;
}

export function clearStorageBreadcrumbs(): void {
  breadcrumbs = [];
  breadcrumbSeq = 0;
}

let sessionId: string | null = null;

export function getOrCreateSessionId(): string {
  if (!sessionId) {
    sessionId = createUuid();
  }
  return sessionId;
}

export function resetSessionId(): void {
  sessionId = null;
}

function resolveHeartbeatUrl(): string {
  const baseUrl = env.bffUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/api')) {
    return `${baseUrl}/diagnostics/heartbeat`;
  }
  return `${baseUrl}/api/diagnostics/heartbeat`;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatSequence = 0;

export type HeartbeatGetters = {
  getRoute: () => string;
  getActiveWarehouseMode: () => string;
  getFloorId: () => string | null;
  getPublishedCellCount: () => number;
  getOccupancyRowCount: () => number;
  getNavigatorItemCount: () => number | null;
  getDebugFlags: () => StorageDebugFlags;
};

export function startStorageHeartbeat(getters: HeartbeatGetters): void {
  if (heartbeatTimer !== null) return;

  const send = () => {
    heartbeatSequence++;
    const payload: HeartbeatPayload = {
      sessionId: getOrCreateSessionId(),
      sequence: heartbeatSequence,
      timestamp: new Date().toISOString(),
      route: getters.getRoute(),
      activeWarehouseMode: getters.getActiveWarehouseMode(),
      floorId: getters.getFloorId(),
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
      devicePixelRatio: typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
      publishedCellCount: getters.getPublishedCellCount(),
      occupancyRowCount: getters.getOccupancyRowCount(),
      navigatorItemCount: getters.getNavigatorItemCount(),
      recentBreadcrumbs: getStorageBreadcrumbs().slice(0, 10),
      activeDebugFlags: getters.getDebugFlags(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : ''
    };

    void sendHeartbeat(payload);
  };

  send();
  heartbeatTimer = setInterval(send, 2000);
}

async function sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
  try {
    await fetch(resolveHeartbeatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(payload)
    });
  } catch {
    // diagnostics must never throw
  }
}

export function stopStorageHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  heartbeatSequence = 0;
}

export function isStorageHeartbeatRunning(): boolean {
  return heartbeatTimer !== null;
}
