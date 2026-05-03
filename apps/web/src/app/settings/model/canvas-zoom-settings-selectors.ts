import { useCanvasZoomSettingsStore } from './canvas-zoom-settings';

export const useCanvasMinZoom = () =>
  useCanvasZoomSettingsStore((state) => state.minZoom);
export const useCanvasMaxZoom = () =>
  useCanvasZoomSettingsStore((state) => state.maxZoom);
export const useSetCanvasMinZoom = () =>
  useCanvasZoomSettingsStore((state) => state.setMinZoom);
export const useSetCanvasMaxZoom = () =>
  useCanvasZoomSettingsStore((state) => state.setMaxZoom);
export const useResetCanvasZoomBounds = () =>
  useCanvasZoomSettingsStore((state) => state.resetZoomBounds);

