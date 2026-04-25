import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ContainerType, ProductPackagingLevel, StoragePreset } from '@wos/domain';
import type { CreateStoragePresetInput } from '@/entities/product/api/mutations';

type ProductStoragePresetsSectionProps = {
  productId: string;
  storagePresetsQuery: UseQueryResult<StoragePreset[], Error>;
  packagingLevelsQuery: UseQueryResult<ProductPackagingLevel[], Error>;
  containerTypesQuery: UseQueryResult<ContainerType[], Error>;
  createStoragePresetMutation: UseMutationResult<StoragePreset, Error, CreateStoragePresetInput>;
  defaultCreating?: boolean;
  variant?: 'standalone' | 'embedded';
  onCreateClosed?: () => void;
  onCreated?: () => void;
};

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPreferredContainerTypeCode(types: ContainerType[]) {
  return types.find((type) => type.code.toLowerCase() === 'pallet')?.code ?? types[0]?.code ?? '';
}

function formatPackagingLevelOption(level: ProductPackagingLevel) {
  const name = level.name.trim();
  const code = level.code.trim();
  const unitLabel = level.baseUnitQty === 1 ? 'unit' : 'units';

  if (!name) {
    return `Unnamed level - ${level.baseUnitQty} ${unitLabel}`;
  }

  return code
    ? `${name} - ${level.baseUnitQty} ${unitLabel} (${code.toUpperCase()})`
    : `${name} - ${level.baseUnitQty} ${unitLabel}`;
}

function getStoragePresetEmptyState(args: {
  hasStorableLevels: boolean;
  hasStorageCapableContainerTypes: boolean;
}) {
  if (!args.hasStorableLevels) {
    return 'No storage presets can be created until a storable pack type is available.';
  }

  if (!args.hasStorageCapableContainerTypes) {
    return 'Storage setup is unavailable because no storage-capable container types are configured.';
  }

  return 'No storage presets defined yet. Create one to describe how this product is normally stored.';
}

function getStoragePreview(args: {
  selectedContainerType: ContainerType | null;
  selectedLevel: ProductPackagingLevel | null;
  packCount: string;
}) {
  const count = parsePositiveInt(args.packCount);
  if (!args.selectedContainerType || !args.selectedLevel || count === null) {
    return null;
  }

  const packName = args.selectedLevel.name.trim() || 'Unnamed level';
  const totalUnits = count * args.selectedLevel.baseUnitQty;

  return {
    count,
    packName,
    unitsPerPack: args.selectedLevel.baseUnitQty,
    containerTypeCode: args.selectedContainerType.code,
    totalUnits
  };
}

export function ProductStoragePresetsSection({
  productId,
  storagePresetsQuery,
  packagingLevelsQuery,
  containerTypesQuery,
  createStoragePresetMutation,
  defaultCreating = false,
  variant = 'standalone',
  onCreateClosed,
  onCreated
}: ProductStoragePresetsSectionProps) {
  const [isCreating, setIsCreating] = useState(defaultCreating);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selectedContainerTypeCode, setSelectedContainerTypeCode] = useState('');
  const [levelId, setLevelId] = useState('');
  const [packCount, setPackCount] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const storableLevels = (packagingLevelsQuery.data ?? []).filter((level) => level.isActive && level.canStore);
  const selectedLevel = storableLevels.find((level) => level.id === levelId) ?? storableLevels[0] ?? null;
  const storableContainerTypes = useMemo(
    () => (containerTypesQuery.data ?? []).filter((type) => type.supportsStorage),
    [containerTypesQuery.data]
  );
  const selectedContainerType = storableContainerTypes.find(
    (type) => type.code === selectedContainerTypeCode
  ) ?? null;
  const createDisabled =
    createStoragePresetMutation.isPending ||
    containerTypesQuery.isLoading ||
    containerTypesQuery.isError ||
    storableContainerTypes.length === 0 ||
    selectedLevel === null ||
    selectedContainerType === null;
  const containerTypeHelper = containerTypesQuery.isLoading
    ? 'Loading container types...'
    : containerTypesQuery.isError
      ? 'Failed to load container types.'
      : storableContainerTypes.length === 0
        ? 'No storage-capable container types available.'
        : 'Only storage-capable container types are available.';
  const storageEmptyState = getStoragePresetEmptyState({
    hasStorableLevels: storableLevels.length > 0,
    hasStorageCapableContainerTypes: storableContainerTypes.length > 0
  });
  const storagePreview = getStoragePreview({
    selectedContainerType,
    selectedLevel,
    packCount
  });
  const packTypeHelper = 'Only active packaging levels marked "Can be stored" appear here.';

  useEffect(() => {
    if (defaultCreating) {
      setIsCreating(true);
    }
  }, [defaultCreating]);

  useEffect(() => {
    if (storableContainerTypes.length === 0) {
      if (selectedContainerTypeCode !== '') {
        setSelectedContainerTypeCode('');
      }
      return;
    }

    if (!storableContainerTypes.some((type) => type.code === selectedContainerTypeCode)) {
      setSelectedContainerTypeCode(getPreferredContainerTypeCode(storableContainerTypes));
    }
  }, [selectedContainerTypeCode, storableContainerTypes]);

  async function handleCreate() {
    if (!selectedLevel) {
      setError('Add an active storable packaging level before defining a storage preset.');
      return;
    }
    const count = parsePositiveInt(packCount);
    if (!count) {
      setError('Pack count must be a positive whole number.');
      return;
    }
    if (!selectedContainerType) {
      setError('Choose a storage-capable container type.');
      return;
    }
    if (!code.trim() || !name.trim()) {
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
            containerType: selectedContainerType.code,
            legacyProductPackagingLevelId: selectedLevel.id
          }
        ]
      });
      setIsCreating(false);
      setCode('');
      setName('');
      setPackCount('1');
      onCreated?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create storage preset.');
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {variant === 'embedded' ? 'Storage preset' : '3. Storage Presets'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Define how storable pack types fit into containers.
          </p>
        </div>
        {!storagePresetsQuery.isLoading && !storagePresetsQuery.isError ? (
          <button
            type="button"
            onClick={() => {
              if (isCreating) {
                setIsCreating(false);
                onCreateClosed?.();
                return;
              }

              setIsCreating(true);
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {isCreating ? 'Close form' : 'Add preset'}
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
            <div className="text-sm text-slate-600">{storageEmptyState}</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {(storagePresetsQuery.data ?? []).map((preset) => {
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
                    {preset.levels.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-500">No composition levels</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {preset.levels.map((level, index) => (
                          <div
                            key={`${preset.id}-${level.levelType}-${level.qtyEach}-${index}`}
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500"
                          >
                            <span className="font-mono text-slate-700">{level.levelType}</span>
                            <span>{level.qtyEach} each</span>
                            {level.containerType ? <span>{level.containerType}</span> : null}
                            <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {preset.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isCreating ? (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3">
              {storableLevels.length === 0 ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <div className="font-semibold">No storable pack types available.</div>
                  <div className="mt-1">To create a storage preset, first add a packaging level that is:</div>
                  <ul className="mt-1 space-y-0.5">
                    <li>{'\u2713'} Active</li>
                    <li>{'\u2713'} Can be stored</li>
                  </ul>
                  <a href="#packaging-levels" className="mt-2 inline-flex text-xs font-semibold text-amber-900 underline">
                    Go to Packaging Levels
                  </a>
                </div>
              ) : null}
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
                  Container type
                  <select
                    value={selectedContainerTypeCode}
                    onChange={(event) => setSelectedContainerTypeCode(event.target.value)}
                    disabled={containerTypesQuery.isLoading || containerTypesQuery.isError || storableContainerTypes.length === 0}
                    aria-label="Container type"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal disabled:opacity-50"
                  >
                    <option value="">
                      {containerTypesQuery.isLoading
                        ? 'Loading container types...'
                        : storableContainerTypes.length === 0
                          ? 'No storage-capable types'
                          : 'Select container type'}
                    </option>
                    {storableContainerTypes.map((type) => (
                      <option key={type.id} value={type.code}>
                        {type.code} - {type.description}
                      </option>
                    ))}
                  </select>
                  <span className={containerTypesQuery.isError || storableContainerTypes.length === 0 ? 'text-xs font-normal text-amber-700' : 'text-xs font-normal text-slate-500'}>
                    {containerTypeHelper}
                  </span>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Pack type from Packaging Levels
                  <select
                    value={selectedLevel?.id ?? ''}
                    onChange={(event) => setLevelId(event.target.value)}
                    disabled={storableLevels.length === 0}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal disabled:opacity-50"
                  >
                    <option value="">
                      {storableLevels.length === 0 ? 'No storable pack types' : 'Select pack type'}
                    </option>
                    {storableLevels.map((level) => (
                      <option key={level.id} value={level.id}>{formatPackagingLevelOption(level)}</option>
                    ))}
                  </select>
                  <span className={storableLevels.length === 0 ? 'text-xs font-normal text-amber-700' : 'text-xs font-normal text-slate-500'}>
                    {packTypeHelper}
                  </span>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Number of packs in container
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={packCount}
                    onChange={(event) => setPackCount(event.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                  />
                </label>
              </div>
              <div className="mt-3 rounded-lg border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage formula</div>
                {storagePreview ? (
                  <div className="mt-1 space-y-1">
                    <div className="font-medium text-slate-900">
                      {storagePreview.count} {'\u00d7'} {storagePreview.packName} / {storagePreview.unitsPerPack}{' '}
                      {storagePreview.unitsPerPack === 1 ? 'unit' : 'units'} {'\u2192'} Standard{' '}
                      {storagePreview.containerTypeCode}
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      Total: {storagePreview.totalUnits} units per {storagePreview.containerTypeCode}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-slate-600">
                    Choose a pack type, number of packs, and container type to preview the storage formula.
                  </div>
                )}
              </div>
              {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createDisabled}
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
