import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { WarehouseLabelPresetId, WarehouseLabelPreviewResponse } from '@wos/domain';
import { warehouseLabelPresetIds } from '@wos/domain';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { BffRequestError } from '@/shared/api/bff/client';
import { routes } from '@/shared/config/routes';
import type { TranslationKey } from '@/shared/i18n/translations';
import { useT } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Panel } from '@/shared/ui/panel';
import { Section } from '@/shared/ui/section';
import { WarehouseTopBar } from '@/warehouse/shell/ui/warehouse-top-bar';
import {
  computePreviewFingerprint,
  fingerprintsMatch,
  triggerBlobDownload,
  useWarehouseLabelPdfDownload,
  useWarehouseLabelPreview,
  type PreviewFingerprint
} from '../api/warehouse-labels-api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PresetOption = {
  id: WarehouseLabelPresetId;
  labelKey: TranslationKey;
};

const PRESET_OPTIONS: PresetOption[] = [
  { id: 'rack-slot-100x50', labelKey: 'warehouse.labels.preset100x50' },
  { id: 'rack-slot-100x60', labelKey: 'warehouse.labels.preset100x60' },
  { id: 'rack-slot-70x40', labelKey: 'warehouse.labels.preset70x40' }
];

export function WarehouseLabelsPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFloorId = useActiveFloorId();

  const paramFloorId = searchParams.get('floorId') ?? '';
  const isValidFloorIdParam = paramFloorId === '' || UUID_REGEX.test(paramFloorId);

  const resolvedFloorId = useMemo(() => {
    if (paramFloorId && UUID_REGEX.test(paramFloorId)) return paramFloorId;
    if (activeFloorId) {
      if (!paramFloorId && activeFloorId) {
        return activeFloorId;
      }
      return activeFloorId;
    }
    return null;
  }, [paramFloorId, activeFloorId]);

  useEffect(() => {
    if (paramFloorId === '' && activeFloorId) {
      setSearchParams({ floorId: activeFloorId }, { replace: true });
    }
  }, [paramFloorId, activeFloorId, setSearchParams]);

  const [preset, setPreset] = useState<WarehouseLabelPresetId>('rack-slot-100x50');
  const [previewData, setPreviewData] = useState<WarehouseLabelPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<PreviewFingerprint | null>(null);

  const previewMutation = useWarehouseLabelPreview();
  const pdfMutation = useWarehouseLabelPdfDownload();

  const currentFingerprint = resolvedFloorId
    ? computePreviewFingerprint(resolvedFloorId, preset)
    : null;

  const isPreviewStale = !fingerprintsMatch(currentFingerprint, previewFingerprint);

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (warehouseLabelPresetIds.includes(value as WarehouseLabelPresetId)) {
      setPreset(value as WarehouseLabelPresetId);
    }
  }, []);

  const handlePreview = useCallback(() => {
    if (!resolvedFloorId) return;
    const request = {
      floorId: resolvedFloorId,
      selection: { mode: 'entire-floor' as const },
      labelPreset: preset,
      layout: { mode: 'single-label-page' as const },
      sort: 'address' as const
    };

    setPreviewError(null);
    previewMutation.mutate(request, {
      onSuccess: (data) => {
        setPreviewData(data);
        setPreviewFingerprint(computePreviewFingerprint(resolvedFloorId, preset));
      },
      onError: (error) => {
        setPreviewData(null);
        setPreviewFingerprint(null);
        if (error instanceof BffRequestError) {
          setPreviewError(error.message);
        } else {
          setPreviewError(t('warehouse.labels.previewFailed'));
        }
      }
    });
  }, [resolvedFloorId, preset, previewMutation, t]);

  const handleDownload = useCallback(() => {
    if (!resolvedFloorId || isPreviewStale || !previewData) return;
    const request = {
      floorId: resolvedFloorId,
      selection: { mode: 'entire-floor' as const },
      labelPreset: preset,
      layout: { mode: 'single-label-page' as const },
      sort: 'address' as const
    };

    pdfMutation.mutate(request, {
      onSuccess: (download) => {
        triggerBlobDownload(download);
      },
      onError: (error) => {
        if (error instanceof BffRequestError) {
          setPreviewError(error.message);
        } else {
          setPreviewError(t('warehouse.labels.downloadFailed'));
        }
      }
    });
  }, [resolvedFloorId, preset, isPreviewStale, previewData, pdfMutation, t]);

  const canDownload =
    resolvedFloorId &&
    previewData &&
    !isPreviewStale &&
    previewData.labelCount > 0 &&
    !pdfMutation.isPending;

  if (!isValidFloorIdParam) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <WarehouseTopBar />
        <div className="flex flex-1 items-center justify-center">
          <Panel padding="md">
            <p className="text-sm font-medium text-red-600">
              {t('warehouse.labels.malformedFloorId')}
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  if (!resolvedFloorId) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <WarehouseTopBar />
        <div className="flex flex-1 items-center justify-center">
          <Panel padding="md">
            <p className="text-sm font-medium text-amber-600">
              {t('warehouse.labels.noFloor')}
            </p>
            <button
              type="button"
              onClick={() => navigate(routes.warehouseActions)}
              className="mt-3 text-sm font-medium text-cyan-700 hover:text-cyan-800"
            >
              {t('warehouse.labels.goToActions')}
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  const sortedSampleLabels = previewData && !isPreviewStale ? previewData.sampleLabels : [];
  const warnings = previewData && !isPreviewStale ? previewData.warnings : [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <WarehouseTopBar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="text-lg font-semibold text-slate-900">
            {t('warehouse.labels.title')}
          </h1>

          <div className="mt-6 space-y-5">
            <Section title={t('warehouse.labels.floorContext')}>
              <p className="text-sm text-slate-700 font-mono">{resolvedFloorId}</p>
            </Section>

            <Section title={t('warehouse.labels.selectionLabel')}>
              <p className="text-sm text-slate-500">
                {t('warehouse.labels.entireFloor')}
              </p>
            </Section>

            <Section title={t('warehouse.labels.preset')}>
              <select
                value={preset}
                onChange={handlePresetChange}
                disabled={previewMutation.isPending}
                className="h-8 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {PRESET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </Section>

            <Section title={t('warehouse.labels.layoutLabel')}>
              <p className="text-sm text-slate-500">
                {t('warehouse.labels.singleLabelPage')}
              </p>
            </Section>

            <div className="flex justify-start">
              <Button
                variant="solid"
                size="sm"
                onClick={handlePreview}
                disabled={!resolvedFloorId || previewMutation.isPending}
                className="text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {previewMutation.isPending
                  ? t('warehouse.labels.previewing')
                  : t('warehouse.labels.preview')}
              </Button>
            </div>

            {previewError && (
              <Panel tone="default" padding="sm">
                <p className="text-sm text-red-600">{previewError}</p>
              </Panel>
            )}

            {previewData && !isPreviewStale && (
              <Panel padding="md">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {t('warehouse.labels.labelCount')}:
                    </span>
                    <span className="text-sm text-slate-900">{previewData.labelCount}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {t('warehouse.labels.pageCount')}:
                    </span>
                    <span className="text-sm text-slate-900">{previewData.pageCount}</span>
                  </div>

                  {sortedSampleLabels.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        {t('warehouse.labels.sampleLabels')}:
                      </p>
                      <ul className="text-sm text-slate-600 space-y-0.5">
                        {sortedSampleLabels.map((sample) => (
                          <li key={sample.locationId} className="font-mono">
                            {sample.address}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-600 mb-1">
                        {t('warehouse.labels.warnings')}:
                      </p>
                      <ul className="text-sm text-amber-600 space-y-0.5">
                        {warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {previewData.labelCount === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      {t('warehouse.labels.emptyPreview')}
                    </p>
                  )}
                </div>
              </Panel>
            )}

            <div className="flex justify-start">
              <Button
                variant="solid"
                size="sm"
                disabled={!canDownload}
                onClick={handleDownload}
                className="text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {pdfMutation.isPending
                  ? t('warehouse.labels.downloading')
                  : t('warehouse.labels.downloadPdf')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}