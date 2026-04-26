import type { Product, ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import {
  formatClassName,
  formatDimensions,
  formatWeight,
  getUnitProfileWarnings
} from './unit-profile-formatters';
import type { UnitProfileDraft, UnitProfileNumericField } from './section-editing';

type ClassField = 'weightClass' | 'sizeClass';

type ProductFactsCardProps = {
  product: Product;
  unitProfile: ProductUnitProfile | null | undefined;
  packagingLevels: ProductPackagingLevel[];
  storagePresetCount: number;
  isSelected?: boolean;
  isEditing: boolean;
  unitProfileDraft: UnitProfileDraft;
  unitProfileFieldErrors: Partial<Record<UnitProfileNumericField, string>>;
  unitProfileSaveError: string | null;
  unitProfileDirty: boolean;
  isSaving: boolean;
  onEditProductFacts: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onNumericFieldChange: (field: UnitProfileNumericField, value: string) => void;
  onClassFieldChange: (field: ClassField, value: UnitProfileDraft[ClassField]) => void;
};

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function NumberField({
  label,
  value,
  error,
  onChange
}: {
  label: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
      />
      {error ? <span className="text-xs font-normal text-red-700">{error}</span> : null}
    </label>
  );
}

export function ProductFactsCard({
  product,
  unitProfile,
  packagingLevels,
  storagePresetCount,
  isSelected = false,
  isEditing,
  unitProfileDraft,
  unitProfileFieldErrors,
  unitProfileSaveError,
  unitProfileDirty,
  isSaving,
  onEditProductFacts,
  onCancelEdit,
  onSaveEdit,
  onNumericFieldChange,
  onClassFieldChange
}: ProductFactsCardProps) {
  const warnings = getUnitProfileWarnings({ unitProfile, packagingLevels, storagePresetCount });

  return (
    <article
      aria-current={isSelected ? 'step' : undefined}
      className={[
        'rounded-lg border bg-white p-4 transition',
        isSelected ? 'border-cyan-300 bg-cyan-50/40 ring-2 ring-cyan-100' : 'border-slate-200'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Product Facts</div>
          </div>
          <h2 className="mt-1 truncate text-base font-semibold text-slate-950">{product.name}</h2>
        </div>
        {isEditing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isSaving}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isSaving}
              className="rounded-md bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEditProductFacts}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit facts
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-3 grid gap-3">
          {unitProfileDirty ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
              Unsaved changes
            </div>
          ) : null}
          {unitProfileSaveError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {unitProfileSaveError}
            </div>
          ) : null}

          <div className="grid gap-2">
            <NumberField
              label="Weight (g)"
              value={unitProfileDraft.unitWeightG}
              error={unitProfileFieldErrors.unitWeightG}
              onChange={(value) => onNumericFieldChange('unitWeightG', value)}
            />
            <NumberField
              label="Width (mm)"
              value={unitProfileDraft.unitWidthMm}
              error={unitProfileFieldErrors.unitWidthMm}
              onChange={(value) => onNumericFieldChange('unitWidthMm', value)}
            />
            <NumberField
              label="Height (mm)"
              value={unitProfileDraft.unitHeightMm}
              error={unitProfileFieldErrors.unitHeightMm}
              onChange={(value) => onNumericFieldChange('unitHeightMm', value)}
            />
            <NumberField
              label="Depth (mm)"
              value={unitProfileDraft.unitDepthMm}
              error={unitProfileFieldErrors.unitDepthMm}
              onChange={(value) => onNumericFieldChange('unitDepthMm', value)}
            />
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Weight class
              <select
                value={unitProfileDraft.weightClass}
                onChange={(event) =>
                  onClassFieldChange('weightClass', event.target.value as UnitProfileDraft['weightClass'])
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
              >
                <option value="">Not defined</option>
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
                <option value="very_heavy">Very heavy</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Size class
              <select
                value={unitProfileDraft.sizeClass}
                onChange={(event) =>
                  onClassFieldChange('sizeClass', event.target.value as UnitProfileDraft['sizeClass'])
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900"
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
      ) : (
        <dl className="mt-3">
          <FactRow label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
          <FactRow label="Base weight" value={formatWeight(unitProfile?.unitWeightG)} />
          <FactRow
            label="Base dimensions"
            value={formatDimensions({
              widthMm: unitProfile?.unitWidthMm,
              heightMm: unitProfile?.unitHeightMm,
              depthMm: unitProfile?.unitDepthMm
            })}
          />
          <FactRow label="Size class" value={formatClassName(unitProfile?.sizeClass)} />
          <FactRow label="Weight class" value={formatClassName(unitProfile?.weightClass)} />
        </dl>
      )}

      {!isEditing && warnings.length > 0 ? (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">
            {warnings.length} {warnings.length === 1 ? 'setup warning' : 'setup warnings'}
          </summary>
          <ul className="mt-2 grid gap-1 text-amber-800">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
