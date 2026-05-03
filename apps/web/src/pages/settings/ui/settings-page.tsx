import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  HARD_MAX_CANVAS_ZOOM,
  HARD_MIN_CANVAS_ZOOM
} from '@/entities/layout-version/lib/canvas-geometry';
import {
  useCanvasMaxZoom,
  useCanvasMinZoom,
  useResetCanvasZoomBounds,
  useSetCanvasMaxZoom,
  useSetCanvasMinZoom
} from '@/app/settings/model/canvas-zoom-settings-selectors';
import { Button } from '@/shared/ui/button';
import { Section } from '@/shared/ui/section';

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function percentToZoom(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

export function SettingsPage() {
  const minZoom = useCanvasMinZoom();
  const maxZoom = useCanvasMaxZoom();
  const setMinZoom = useSetCanvasMinZoom();
  const setMaxZoom = useSetCanvasMaxZoom();
  const resetZoomBounds = useResetCanvasZoomBounds();

  const minPercent = formatPercent(minZoom);
  const maxPercent = formatPercent(maxZoom);
  const hardMinPercent = formatPercent(HARD_MIN_CANVAS_ZOOM);
  const hardMaxPercent = formatPercent(HARD_MAX_CANVAS_ZOOM);

  return (
    <main className="min-h-full bg-slate-50 px-6 py-6 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Workspace preferences for this browser.</p>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </header>

        <Section
          title="Canvas zoom"
          subtitle="Limits apply to wheel, pinch, toolbar buttons, and layout auto-fit."
          action={
            <Button
              type="button"
              variant="ghost"
              onClick={resetZoomBounds}
              className="gap-1.5 text-slate-600"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Defaults
            </Button>
          }
          bodyClassName="grid gap-5 md:grid-cols-2"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Minimum zoom
            </span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={hardMinPercent}
                max={maxPercent - 5}
                step={5}
                value={minPercent}
                onChange={(event) => {
                  const next = percentToZoom(event.target.value);
                  if (next !== null) setMinZoom(next);
                }}
                className="min-w-0 flex-1"
              />
              <input
                type="number"
                min={hardMinPercent}
                max={maxPercent - 5}
                step={5}
                value={minPercent}
                onChange={(event) => {
                  const next = percentToZoom(event.target.value);
                  if (next !== null) setMinZoom(next);
                }}
                className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-right text-sm font-medium"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Maximum zoom
            </span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={minPercent + 5}
                max={hardMaxPercent}
                step={5}
                value={maxPercent}
                onChange={(event) => {
                  const next = percentToZoom(event.target.value);
                  if (next !== null) setMaxZoom(next);
                }}
                className="min-w-0 flex-1"
              />
              <input
                type="number"
                min={minPercent + 5}
                max={hardMaxPercent}
                step={5}
                value={maxPercent}
                onChange={(event) => {
                  const next = percentToZoom(event.target.value);
                  if (next !== null) setMaxZoom(next);
                }}
                className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-right text-sm font-medium"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </label>
        </Section>
      </div>
    </main>
  );
}

