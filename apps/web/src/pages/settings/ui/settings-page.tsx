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
import { useI18n, type Locale } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Section } from '@/shared/ui/section';

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function percentToZoom(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

const languageOptions: Array<{ locale: Locale; labelKey: 'settings.language.hebrew' | 'settings.language.english' }> = [
  { locale: 'he', labelKey: 'settings.language.hebrew' },
  { locale: 'en', labelKey: 'settings.language.english' }
];

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
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
            <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('settings.description')}</p>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </header>

        <Section
          title={t('settings.language.title')}
          subtitle={t('settings.language.subtitle')}
          bodyClassName="flex flex-col gap-3"
        >
          <div className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-100 p-1">
            {languageOptions.map((option) => {
              const selected = option.locale === locale;
              return (
                <button
                  key={option.locale}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLocale(option.locale)}
                  className={`h-8 rounded px-3 text-sm font-semibold transition-colors ${
                    selected
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            {t('settings.language.current', {
              language: t(locale === 'he' ? 'settings.language.hebrew' : 'settings.language.english')
            })}
          </p>
        </Section>

        <Section
          title={t('settings.canvasZoom.title')}
          subtitle={t('settings.canvasZoom.subtitle')}
          action={
            <Button
              type="button"
              variant="ghost"
              onClick={resetZoomBounds}
              className="gap-1.5 text-slate-600"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('settings.canvasZoom.defaults')}
            </Button>
          }
          bodyClassName="grid gap-5 md:grid-cols-2"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('settings.canvasZoom.minimum')}
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
                className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-end text-sm font-medium"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('settings.canvasZoom.maximum')}
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
                className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-end text-sm font-medium"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </label>
        </Section>
      </div>
    </main>
  );
}
