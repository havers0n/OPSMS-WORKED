export type CanvasRenderMode =
  | 'full'
  | 'interaction-light'
  | 'interaction-skeleton'
  | 'restore-base'
  | 'restore-overlays'
  | 'restore-labels';

export function isCanvasInteractionRenderMode(mode: CanvasRenderMode) {
  return mode === 'interaction-light' || mode === 'interaction-skeleton';
}

export function isCanvasRestoreRenderMode(mode: CanvasRenderMode) {
  return (
    mode === 'restore-base' ||
    mode === 'restore-overlays' ||
    mode === 'restore-labels'
  );
}

export function isCanvasFullDetailRenderMode(mode: CanvasRenderMode) {
  return mode === 'full';
}
