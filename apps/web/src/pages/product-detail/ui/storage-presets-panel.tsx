import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { StoragePresetCard } from './storage-preset-card';

type StoragePresetsPanelProps = {
  storagePresets: StoragePreset[];
  packagingLevels: ProductPackagingLevel[];
};

export function StoragePresetsPanel({ storagePresets, packagingLevels }: StoragePresetsPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Storage Presets</div>
        <h2 className="mt-1 text-base font-semibold text-slate-950">Storage cards</h2>
        <p className="mt-1 text-xs text-slate-500">
          Presets stay separate from packaging levels and resolve their linked pack type when possible.
        </p>
      </div>

      {storagePresets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
          No storage presets defined yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
          {storagePresets.map((preset) => (
            <StoragePresetCard key={preset.id} preset={preset} packagingLevels={packagingLevels} />
          ))}
        </div>
      )}
    </section>
  );
}
