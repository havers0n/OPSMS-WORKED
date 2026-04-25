import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import type { CreateStoragePresetInput } from '@/entities/product/api/mutations';

type ProductStoragePresetsSectionProps = {
  productId: string;
  storagePresetsQuery: UseQueryResult<StoragePreset[], Error>;
  packagingLevelsQuery: UseQueryResult<ProductPackagingLevel[], Error>;
  createStoragePresetMutation: UseMutationResult<StoragePreset, Error, CreateStoragePresetInput>;
};

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function ProductStoragePresetsSection({
  productId,
  storagePresetsQuery,
  packagingLevelsQuery,
  createStoragePresetMutation
}: ProductStoragePresetsSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [containerType, setContainerType] = useState('pallet');
  const [levelId, setLevelId] = useState('');
  const [packCount, setPackCount] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const storableLevels = (packagingLevelsQuery.data ?? []).filter((level) => level.isActive && level.canStore);
  const selectedLevel = storableLevels.find((level) => level.id === levelId) ?? storableLevels[0] ?? null;

  async function handleCreate() {
    if (!selectedLevel) {
      setError('Add an active storable packaging level before defining a storage preset.');
      return;
    }
    const count = parsePositiveInt(packCount);
    if (!count) {
      setError('Pack count must be a positive integer.');
      return;
    }
    if (!code.trim() || !name.trim() || !containerType.trim()) {
      setError('Code, name, and container type are required.');
      return;
    }

    setError(null);
    try {
      await createStoragePresetMutation.mutateAsync({
        productId,
        code: code.trim(),
        name: name.trim(),
        levels: [
          {
            levelType: selectedLevel.code,
            qtyEach: selectedLevel.baseUnitQty * count,
            containerType: containerType.trim(),
            legacyProductPackagingLevelId: selectedLevel.id
          }
        ]
      });
      setIsCreating(false);
      setCode('');
      setName('');
      setPackCount('1');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create storage preset.');
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Storage Presets</h2>
          <p className="mt-0.5 text-xs text-slate-500">Standard storage forms, separate from pick UOM authoring.</p>
        </div>
        {!storagePresetsQuery.isLoading && !storagePresetsQuery.isError ? (
          <button
            type="button"
            onClick={() => setIsCreating((value) => !value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {isCreating ? 'Cancel' : 'Add preset'}
          </button>
        ) : null}
      </div>

      {storagePresetsQuery.isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
        </div>
      ) : storagePresetsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-red-700">
          <span>{storagePresetsQuery.error?.message ?? 'Failed to load storage presets.'}</span>
          <button
            type="button"
            onClick={() => void storagePresetsQuery.refetch()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {(storagePresetsQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-slate-600">No storage presets defined yet.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {(storagePresetsQuery.data ?? []).map((preset) => {
                const level = preset.levels[0];
                return (
                  <div key={preset.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-slate-900">{preset.code}</div>
                        <div className="truncate text-sm text-slate-700">{preset.name}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {preset.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {level ? `${level.qtyEach} each via ${level.levelType}` : 'No composition levels'}
                      {level?.containerType ? ` / ${level.containerType}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isCreating ? (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Code
                  <input value={code} onChange={(event) => setCode(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Container type code
                  <input value={containerType} onChange={(event) => setContainerType(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Packaging level
                  <select value={selectedLevel?.id ?? ''} onChange={(event) => setLevelId(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal">
                    {storableLevels.map((level) => (
                      <option key={level.id} value={level.id}>{level.code} - {level.baseUnitQty} each</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Pack count
                  <input value={packCount} onChange={(event) => setPackCount(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
              </div>
              {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createStoragePresetMutation.isPending}
                className="mt-3 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {createStoragePresetMutation.isPending ? 'Creating...' : 'Create storage preset'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
