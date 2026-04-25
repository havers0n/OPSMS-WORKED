import { RefreshCw } from 'lucide-react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ProductUnitProfile } from '@wos/domain';
import type { UpsertProductUnitProfileBody } from '@/entities/product/api/mutations';
import type { UnitProfileDraft, UnitProfileNumericField } from './section-editing';

function formatClass(value: string | null) {
  if (!value) return 'Not defined';
  return value.replace(/_/g, ' ');
}

function formatMeasurement(value: number | null, unit: string) {
  if (value === null) return 'Not defined';
  return `${value} ${unit}`;
}

type ProductUnitProfileSectionProps = {
  unitProfileQuery: UseQueryResult<ProductUnitProfile | null, Error>;
  upsertUnitProfileMutation: UseMutationResult<
    ProductUnitProfile,
    Error,
    { productId: string; body: UpsertProductUnitProfileBody }
  >;
  isUnitProfileEditing: boolean;
  unitProfileDraft: UnitProfileDraft;
  unitProfileFieldErrors: Partial<Record<UnitProfileNumericField, string>>;
  unitProfileSaveError: string | null;
  unitProfileDirty: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onNumericFieldChange: (field: UnitProfileNumericField, value: string) => void;
  onClassFieldChange: (
    field: 'weightClass' | 'sizeClass',
    value: UnitProfileDraft['weightClass'] | UnitProfileDraft['sizeClass']
  ) => void;
};

export function ProductUnitProfileSection({
  unitProfileQuery,
  upsertUnitProfileMutation,
  isUnitProfileEditing,
  unitProfileDraft,
  unitProfileFieldErrors,
  unitProfileSaveError,
  unitProfileDirty,
  onBeginEdit,
  onCancelEdit,
  onSave,
  onNumericFieldChange,
  onClassFieldChange
}: ProductUnitProfileSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">1. Single Unit Profile</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Describes one individual unit of this product. Packaging levels are built from this unit.
          </p>
        </div>
        {unitProfileQuery.isLoading || unitProfileQuery.isError ? null : isUnitProfileEditing ? (
          <div className="flex items-center gap-2">
            {unitProfileDirty ? (
              <span className="text-xs font-medium text-amber-700">Unsaved changes in this section</span>
            ) : null}
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={upsertUnitProfileMutation.isPending}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Discard unit changes
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={upsertUnitProfileMutation.isPending}
              className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {upsertUnitProfileMutation.isPending ? 'Saving...' : 'Save unit profile'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBeginEdit}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
        )}
      </div>

      {unitProfileQuery.isLoading ? (
        <div className="flex h-24 items-center justify-center p-4">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
        </div>
      ) : unitProfileQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-red-700">
          <span>
            {unitProfileQuery.error instanceof Error
              ? unitProfileQuery.error.message
              : 'Failed to load unit profile.'}
          </span>
          <button
            type="button"
            onClick={() => void unitProfileQuery.refetch()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : isUnitProfileEditing ? (
        <div className="space-y-4 p-4">
          {unitProfileSaveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {unitProfileSaveError}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact Measurements</h3>
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Weight (g)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={unitProfileDraft.unitWeightG}
                    onChange={(event) => onNumericFieldChange('unitWeightG', event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                  {unitProfileFieldErrors.unitWeightG ? (
                    <span className="text-xs text-red-700">{unitProfileFieldErrors.unitWeightG}</span>
                  ) : null}
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Width (mm)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={unitProfileDraft.unitWidthMm}
                    onChange={(event) => onNumericFieldChange('unitWidthMm', event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                  {unitProfileFieldErrors.unitWidthMm ? (
                    <span className="text-xs text-red-700">{unitProfileFieldErrors.unitWidthMm}</span>
                  ) : null}
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Height (mm)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={unitProfileDraft.unitHeightMm}
                    onChange={(event) => onNumericFieldChange('unitHeightMm', event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                  {unitProfileFieldErrors.unitHeightMm ? (
                    <span className="text-xs text-red-700">{unitProfileFieldErrors.unitHeightMm}</span>
                  ) : null}
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Depth (mm)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={unitProfileDraft.unitDepthMm}
                    onChange={(event) => onNumericFieldChange('unitDepthMm', event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                  {unitProfileFieldErrors.unitDepthMm ? (
                    <span className="text-xs text-red-700">{unitProfileFieldErrors.unitDepthMm}</span>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estimated size / weight class
              </h3>
              <p className="mt-1 text-xs text-slate-500">Used only when exact measurements are missing.</p>
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Weight class</span>
                  <select
                    value={unitProfileDraft.weightClass}
                    onChange={(event) =>
                      onClassFieldChange('weightClass', event.target.value as UnitProfileDraft['weightClass'])
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  >
                    <option value="">Not defined</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                    <option value="very_heavy">Very heavy</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-500">Size class</span>
                  <select
                    value={unitProfileDraft.sizeClass}
                    onChange={(event) =>
                      onClassFieldChange('sizeClass', event.target.value as UnitProfileDraft['sizeClass'])
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  >
                    <option value="">Not defined</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="oversized">Oversized</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : !unitProfileQuery.data ? (
        <div className="px-4 py-5 text-sm text-slate-600">Unit profile not defined yet.</div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact Measurements</h3>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Weight</dt>
                <dd className="font-medium text-slate-900">
                  {formatMeasurement(unitProfileQuery.data.unitWeightG, 'g')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Width</dt>
                <dd className="font-medium text-slate-900">
                  {formatMeasurement(unitProfileQuery.data.unitWidthMm, 'mm')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Height</dt>
                <dd className="font-medium text-slate-900">
                  {formatMeasurement(unitProfileQuery.data.unitHeightMm, 'mm')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Depth</dt>
                <dd className="font-medium text-slate-900">
                  {formatMeasurement(unitProfileQuery.data.unitDepthMm, 'mm')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estimated size / weight class
            </h3>
            <p className="mt-1 text-xs text-slate-500">Used only when exact measurements are missing.</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Weight class</dt>
                <dd className="font-medium capitalize text-slate-900">
                  {formatClass(unitProfileQuery.data.weightClass)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Size class</dt>
                <dd className="font-medium capitalize text-slate-900">
                  {formatClass(unitProfileQuery.data.sizeClass)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
