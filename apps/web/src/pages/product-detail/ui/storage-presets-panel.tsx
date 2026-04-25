import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { StoragePresetCard } from './storage-preset-card';

type StoragePresetsPanelProps = {
  presets: StoragePreset[];
  packagingLevels: ProductPackagingLevel[];
  isSelected?: boolean;
  onCreateStoragePreset: () => void;
};

export function StoragePresetsPanel({
  presets,
  packagingLevels,
  isSelected = false,
  onCreateStoragePreset
}: StoragePresetsPanelProps) {
  const hasActiveStorablePackagingLevels = packagingLevels.some((level) => level.isActive && level.canStore);

  return (
    <section
      aria-current={isSelected ? 'step' : undefined}
      className={[
        'rounded-lg border p-4 transition',
        isSelected ? 'border-cyan-300 bg-cyan-50/50 ring-2 ring-cyan-100' : 'border-slate-200 bg-slate-50/70'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Storage Presets</div>
            {isSelected ? (
              <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                Selected
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Storage cards</h2>
          <p className="mt-1 text-xs text-slate-500">
            Presets stay separate from packaging levels and resolve their linked pack type when possible.
          </p>
        </div>
        {presets.length > 0 ? (
          <button
            type="button"
            onClick={onCreateStoragePreset}
            disabled={!hasActiveStorablePackagingLevels}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Create storage preset
          </button>
        ) : null}
      </div>

      {presets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4">
          <div className="text-sm font-semibold text-slate-900">No storage presets defined yet.</div>
          <p className="mt-1 text-sm text-slate-600">
            {hasActiveStorablePackagingLevels
              ? 'Storage presets describe how packaging levels are physically stored.'
              : 'Define active packaging levels first.'}
          </p>
          <button
            type="button"
            onClick={onCreateStoragePreset}
            disabled={!hasActiveStorablePackagingLevels}
            className="mt-3 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Create storage preset
          </button>
          {!hasActiveStorablePackagingLevels ? (
            <p className="mt-2 text-xs text-amber-700">Define active packaging levels first.</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
          {presets.map((preset) => (
            <StoragePresetCard key={preset.id} preset={preset} packagingLevels={packagingLevels} />
          ))}
        </div>
      )}
    </section>
  );
}
