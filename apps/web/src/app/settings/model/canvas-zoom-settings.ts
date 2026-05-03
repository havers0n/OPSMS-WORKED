import { create } from 'zustand';
import {
  type CanvasZoomBounds,
  HARD_MAX_CANVAS_ZOOM,
  HARD_MIN_CANVAS_ZOOM,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  normalizeCanvasZoomBounds
} from '@/entities/layout-version/lib/canvas-geometry';

const STORAGE_KEY = 'wos:canvas-zoom-settings:v1';
const MIN_ZOOM_GAP = 0.05;

type CanvasZoomSettingsState = CanvasZoomBounds & {
  setMinZoom: (minZoom: number) => void;
  setMaxZoom: (maxZoom: number) => void;
  setZoomBounds: (bounds: Partial<CanvasZoomBounds>) => void;
  resetZoomBounds: () => void;
};

const defaultZoomBounds: CanvasZoomBounds = {
  minZoom: MIN_CANVAS_ZOOM,
  maxZoom: MAX_CANVAS_ZOOM
};

function clampToHardRange(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.min(HARD_MAX_CANVAS_ZOOM, Math.max(HARD_MIN_CANVAS_ZOOM, value));
}

function enforceMinGap(bounds: CanvasZoomBounds): CanvasZoomBounds {
  if (bounds.maxZoom - bounds.minZoom >= MIN_ZOOM_GAP) return bounds;

  if (bounds.minZoom + MIN_ZOOM_GAP <= HARD_MAX_CANVAS_ZOOM) {
    return { minZoom: bounds.minZoom, maxZoom: bounds.minZoom + MIN_ZOOM_GAP };
  }

  return { minZoom: bounds.maxZoom - MIN_ZOOM_GAP, maxZoom: bounds.maxZoom };
}

function readStoredZoomBounds(): CanvasZoomBounds {
  if (typeof window === 'undefined') return defaultZoomBounds;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultZoomBounds;
    const parsed = JSON.parse(raw) as Partial<CanvasZoomBounds>;
    return enforceMinGap(normalizeCanvasZoomBounds(parsed));
  } catch {
    return defaultZoomBounds;
  }
}

function writeStoredZoomBounds(bounds: CanvasZoomBounds) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
}

function resolveMinZoom(nextMinZoom: number, currentMaxZoom: number) {
  const clamped = clampToHardRange(nextMinZoom);
  if (clamped === null) return null;
  return Math.min(clamped, Math.max(HARD_MIN_CANVAS_ZOOM, currentMaxZoom - MIN_ZOOM_GAP));
}

function resolveMaxZoom(nextMaxZoom: number, currentMinZoom: number) {
  const clamped = clampToHardRange(nextMaxZoom);
  if (clamped === null) return null;
  return Math.max(clamped, Math.min(HARD_MAX_CANVAS_ZOOM, currentMinZoom + MIN_ZOOM_GAP));
}

const initialZoomBounds = readStoredZoomBounds();

export const useCanvasZoomSettingsStore = create<CanvasZoomSettingsState>((set) => ({
  ...initialZoomBounds,
  setMinZoom: (minZoom) =>
    set((state) => {
      const nextMinZoom = resolveMinZoom(minZoom, state.maxZoom);
      if (nextMinZoom === null) return state;
      const next = { minZoom: nextMinZoom, maxZoom: state.maxZoom };
      writeStoredZoomBounds(next);
      return next;
    }),
  setMaxZoom: (maxZoom) =>
    set((state) => {
      const nextMaxZoom = resolveMaxZoom(maxZoom, state.minZoom);
      if (nextMaxZoom === null) return state;
      const next = { minZoom: state.minZoom, maxZoom: nextMaxZoom };
      writeStoredZoomBounds(next);
      return next;
    }),
  setZoomBounds: (bounds) =>
    set((state) => {
      const next = enforceMinGap(normalizeCanvasZoomBounds({ ...state, ...bounds }));
      writeStoredZoomBounds(next);
      return next;
    }),
  resetZoomBounds: () =>
    set(() => {
      writeStoredZoomBounds(defaultZoomBounds);
      return defaultZoomBounds;
    })
}));

export function resetCanvasZoomSettingsStore() {
  writeStoredZoomBounds(defaultZoomBounds);
  useCanvasZoomSettingsStore.setState(defaultZoomBounds);
}
