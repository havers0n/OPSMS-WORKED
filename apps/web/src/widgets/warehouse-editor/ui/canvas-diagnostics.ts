import { useEffect, useState } from 'react';

export type CanvasDiagnosticsFlags = {
  labels: 'normal' | 'off';
  hitTest: 'normal' | 'off';
  cells: 'normal' | 'off' | 'visible-only';
  cellOverlays: 'normal' | 'surface-only';
};

export const DEFAULT_CANVAS_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal'
};

export const CANVAS_DIAGNOSTICS_EVENT = 'wos:canvas-perf-diagnostics-change';

declare global {
  interface Window {
    __WOS_CANVAS_PERF_DIAGNOSTICS__?: Partial<CanvasDiagnosticsFlags>;
  }
}

function resolveOption<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? value as T
    : fallback;
}

export function getCanvasDiagnosticsFlags(): CanvasDiagnosticsFlags {
  if (typeof window === 'undefined') {
    return DEFAULT_CANVAS_DIAGNOSTICS_FLAGS;
  }

  const raw = window.__WOS_CANVAS_PERF_DIAGNOSTICS__;
  if (!raw) {
    return DEFAULT_CANVAS_DIAGNOSTICS_FLAGS;
  }

  return {
    labels: resolveOption(raw.labels, ['normal', 'off'] as const, DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.labels),
    hitTest: resolveOption(raw.hitTest, ['normal', 'off'] as const, DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.hitTest),
    cells: resolveOption(raw.cells, ['normal', 'off', 'visible-only'] as const, DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.cells),
    cellOverlays: resolveOption(raw.cellOverlays, ['normal', 'surface-only'] as const, DEFAULT_CANVAS_DIAGNOSTICS_FLAGS.cellOverlays)
  };
}

export function useCanvasDiagnosticsFlags(): CanvasDiagnosticsFlags {
  const [flags, setFlags] = useState(getCanvasDiagnosticsFlags);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleChange = () => setFlags(getCanvasDiagnosticsFlags());
    window.addEventListener(CANVAS_DIAGNOSTICS_EVENT, handleChange);
    return () => window.removeEventListener(CANVAS_DIAGNOSTICS_EVENT, handleChange);
  }, []);

  return flags;
}
