import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { WarehouseLabelPresetId, WarehouseLabelPreviewResponse } from '@wos/domain';
import { warehouseLabelPresetIds } from '@wos/domain';
import { useActiveFloorId, useActiveSiteId } from '@/app/store/ui-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloors } from '@/entities/floor/api/use-floors';
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
  useRackSlotLocationRefs,
  useWarehouseLabelPdfDownload,
  useWarehouseLabelPreview,
  type PreviewFingerprint
} from '../api/warehouse-labels-api';
import {
  buildRackLevelOptions,
  buildWarehouseLabelSelection,
  type LabelSelectionState
} from './warehouse-label-selection';

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
  const activeSiteId = useActiveSiteId();
  const activeFloorId = useActiveFloorId();
  const floorsQuery = useFloors(activeSiteId);
  const floors = floorsQuery.data ?? [];

  const paramFloorId = searchParams.get('floorId') ?? '';
  const isValidFloorIdParam = paramFloorId === '' || UUID_REGEX.test(paramFloorId);

  const resolvedFloorId = useMemo(() => {
    if (paramFloorId && UUID_REGEX.test(paramFloorId)) return paramFloorId;
    if (activeFloorId) return activeFloorId;
    return null;
  }, [paramFloorId, activeFloorId]);

  const publishedCellsQuery = usePublishedCells(resolvedFloorId);
  const rackSlotLocationRefsQuery = useRackSlotLocationRefs(resolvedFloorId);

  useEffect(() => {
    if (paramFloorId === '' && activeFloorId) {
      setSearchParams({ floorId: activeFloorId }, { replace: true });
    }
  }, [paramFloorId, activeFloorId, setSearchParams]);

  const [preset, setPreset] = useState<WarehouseLabelPresetId>('rack-slot-100x50');
  const [selectionState, setSelectionState] = useState<LabelSelectionState>({ mode: 'entire-floor' });
  const [previewData, setPreviewData] = useState<WarehouseLabelPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<PreviewFingerprint | null>(null);

  const previewMutation = useWarehouseLabelPreview();
  const pdfMutation = useWarehouseLabelPdfDownload();

  const rackLevelOptions = useMemo(
    () => buildRackLevelOptions(publishedCellsQuery.data ?? [], rackSlotLocationRefsQuery.data ?? []),
    [publishedCellsQuery.data, rackSlotLocationRefsQuery.data]
  );
  const requestSelection = useMemo(
    () => buildWarehouseLabelSelection(selectionState, rackLevelOptions),
    [selectionState, rackLevelOptions]
  );

  const currentFingerprint = resolvedFloorId && requestSelection
    ? computePreviewFingerprint(resolvedFloorId, preset, requestSelection)
    : null;

  const isPreviewStale = !fingerprintsMatch(currentFingerprint, previewFingerprint);

  const pdfLimit = 300;

  function resolvePdfErrorMessage(error: unknown): string | null {
    if (!(error instanceof BffRequestError)) {
      return null;
    }

    if (error.code === 'WAREHOUSE_LABEL_PDF_LIMIT_EXCEEDED') {
      const count = previewData?.labelCount ?? 0;
      return t('warehouse.labels.pdfLimitExceeded', { limit: pdfLimit, count });
    }

    return error.message;
  }

  const handlePresetChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (warehouseLabelPresetIds.includes(value as WarehouseLabelPresetId)) {
      setPreset(value as WarehouseLabelPresetId);
    }
  }, []);

  const handleSelectionModeChange = useCallback((mode: LabelSelectionState['mode']) => {
    setSelectionState(mode === 'entire-floor' ? { mode: 'entire-floor' } : { mode: 'by-rack', selected: {} });
  }, []);

  const handleRackSelectionChange = useCallback((rackId: string, checked: boolean) => {
    setSelectionState((current) => {
      const selected = current.mode === 'by-rack' ? current.selected : {};
      if (!checked) {
        const { [rackId]: _removed, ...rest } = selected;
        return { mode: 'by-rack', selected: rest };
      }

      return {
        mode: 'by-rack',
        selected: {
          ...selected,
          [rackId]: 'all'
        }
      };
    });
  }, []);

  const handleLevelSelectionChange = useCallback((rackId: string, levelKey: string, checked: boolean) => {
    setSelectionState((current) => {
      const selected = current.mode === 'by-rack' ? current.selected : {};
      const rack = rackLevelOptions.find((entry) => entry.rackId === rackId);
      if (!rack) {
        return { mode: 'by-rack', selected };
      }

      const allLevelKeys = rack.levels.map((level) => level.key);
      const currentLevelKeys =
        selected[rackId] === 'all'
          ? allLevelKeys
          : Array.isArray(selected[rackId])
            ? selected[rackId]
            : [];
      const nextLevelKeys = checked
        ? Array.from(new Set([...currentLevelKeys, levelKey]))
        : currentLevelKeys.filter((value) => value !== levelKey);
      const orderedLevelKeys = allLevelKeys.filter((value) => nextLevelKeys.includes(value));

      if (orderedLevelKeys.length === 0) {
        const { [rackId]: _removed, ...rest } = selected;
        return { mode: 'by-rack', selected: rest };
      }

      return {
        mode: 'by-rack',
        selected: {
          ...selected,
          [rackId]: orderedLevelKeys.length === allLevelKeys.length ? 'all' : orderedLevelKeys
        }
      };
    });
  }, [rackLevelOptions]);

  const handlePreview = useCallback(() => {
    if (!resolvedFloorId || !requestSelection) return;
    const request = {
      floorId: resolvedFloorId,
      selection: requestSelection,
      labelPreset: preset,
      layout: { mode: 'single-label-page' as const },
      sort: 'address' as const
    };

    setPreviewError(null);
    previewMutation.mutate(request, {
      onSuccess: (data) => {
        setPreviewData(data);
        setPreviewFingerprint(computePreviewFingerprint(resolvedFloorId, preset, requestSelection));
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
  }, [resolvedFloorId, requestSelection, preset, previewMutation, t]);

  const handleDownload = useCallback(() => {
    if (!resolvedFloorId || !requestSelection || isPreviewStale || !previewData) return;
    const request = {
      floorId: resolvedFloorId,
      selection: requestSelection,
      labelPreset: preset,
      layout: { mode: 'single-label-page' as const },
      sort: 'address' as const
    };

    pdfMutation.mutate(request, {
      onSuccess: (download) => {
        triggerBlobDownload(download);
      },
      onError: (error) => {
        const message = resolvePdfErrorMessage(error);
        setPreviewError(message ?? t('warehouse.labels.downloadFailed'));
      }
    });
  }, [resolvedFloorId, requestSelection, preset, isPreviewStale, previewData, pdfMutation, t]);

  const canPreview = Boolean(resolvedFloorId) && Boolean(requestSelection) && !previewMutation.isPending;
  const canDownload =
    resolvedFloorId &&
    requestSelection &&
    previewData &&
    !isPreviewStale &&
    previewData.labelCount > 0 &&
    !pdfMutation.isPending;

  const resolvedFloor = floors.find((floor) => floor.id === resolvedFloorId);
  const floorLabel = resolvedFloor
    ? resolvedFloor.name.trim()
      ? `${resolvedFloor.code} — ${resolvedFloor.name}`
      : resolvedFloor.code
    : null;
  const isFloorMetadataLoading =
    Boolean(resolvedFloorId) &&
    Boolean(activeSiteId) &&
    floorsQuery.isLoading &&
    floors.length === 0;
  const visibleFloorLabel = floorLabel ?? (isFloorMetadataLoading ? t('warehouse.labels.loading') : resolvedFloorId);

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
  const concretePreviewLabel = sortedSampleLabels[0] ?? null;

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
              <p className={floorLabel ? 'text-sm text-slate-700' : 'text-sm text-slate-700 font-mono'}>
                {visibleFloorLabel}
              </p>
            </Section>

            <Section title={t('warehouse.labels.selectionLabel')}>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="label-selection-mode"
                    checked={selectionState.mode === 'entire-floor'}
                    onChange={() => handleSelectionModeChange('entire-floor')}
                  />
                  <span>{t('warehouse.labels.entireFloor')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="label-selection-mode"
                    checked={selectionState.mode === 'by-rack'}
                    onChange={() => handleSelectionModeChange('by-rack')}
                  />
                  <span>{t('warehouse.labels.byRack')}</span>
                </label>

                {selectionState.mode === 'by-rack' && (
                  <div className="space-y-3 rounded-md border border-slate-200 p-3">
                    {rackSlotLocationRefsQuery.isLoading || publishedCellsQuery.isLoading ? (
                      <p className="text-sm text-slate-500">{t('warehouse.labels.loading')}</p>
                    ) : rackLevelOptions.length === 0 ? (
                      <p className="text-sm text-slate-500">{t('warehouse.labels.noRackSlotLocations')}</p>
                    ) : (
                      rackLevelOptions.map((rack) => {
                        const rackSelection = selectionState.selected[rack.rackId];
                        const selectedLevelKeys =
                          rackSelection === 'all'
                            ? rack.levels.map((level) => level.key)
                            : rackSelection ?? [];

                        return (
                          <div key={rack.rackId} className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                              <input
                                type="checkbox"
                                checked={Boolean(rackSelection)}
                                onChange={(event) => handleRackSelectionChange(rack.rackId, event.target.checked)}
                              />
                              <span>{rack.rackLabel}</span>
                              <span className="text-xs font-normal text-slate-500">
                                {t('warehouse.labels.allLevels')}
                              </span>
                            </label>
                            <div className="flex flex-wrap gap-3 pl-6">
                              {rack.levels.map((level) => (
                                <label key={level.key} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={selectedLevelKeys.includes(level.key)}
                                    onChange={(event) =>
                                      handleLevelSelectionChange(rack.rackId, level.key, event.target.checked)
                                    }
                                  />
                                  <span>{level.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
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
                disabled={!canPreview}
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
                      <p className="mb-1 text-sm font-medium text-slate-700">
                        {t('warehouse.labels.sampleLabels')}:
                      </p>
                      <ul className="space-y-0.5 text-sm text-slate-600">
                        {sortedSampleLabels.map((sample) => (
                          <li key={sample.locationId} className="font-mono">
                            {sample.address}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {concretePreviewLabel && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        {t('warehouse.labels.previewCard')}
                      </p>
                      <div className="flex max-w-xs flex-col gap-2 rounded-md border border-dashed border-slate-300 bg-white p-3">
                        <div className="font-mono text-base text-slate-900">{concretePreviewLabel.address}</div>
                        <div
                          aria-hidden="true"
                          className="h-12 rounded bg-[repeating-linear-gradient(90deg,#0f172a_0px,#0f172a_2px,transparent_2px,transparent_4px,#0f172a_4px,#0f172a_5px,transparent_5px,transparent_7px)]"
                        />
                        <div className="font-mono text-xs tracking-[0.2em] text-slate-700">
                          {concretePreviewLabel.barcodeValue}
                        </div>
                        <p className="text-xs text-slate-500">
                          {t('warehouse.labels.barcodeApproximation')}
                        </p>
                      </div>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div>
                      <p className="mb-1 text-sm font-medium text-amber-600">
                        {t('warehouse.labels.warnings')}:
                      </p>
                      <ul className="space-y-0.5 text-sm text-amber-600">
                        {warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {previewData.labelCount === 0 && (
                    <p className="text-sm italic text-slate-500">
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
