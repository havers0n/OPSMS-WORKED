import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { Boxes, Settings2, Warehouse } from 'lucide-react';
import {
  derivePackagingHierarchy,
  groupStoragePresetsByPackagingLevelId,
  type GroupedStoragePresetItem
} from './packaging-hierarchy';
import { PackagingLevelCard } from './packaging-level-card';
import { formatLevelName } from './unit-profile-formatters';

type ProductPackingHierarchyProps = {
  levels: ProductPackagingLevel[];
  storagePresets: StoragePreset[];
  isPackagingSelected?: boolean;
  isStorageSelected?: boolean;
  onEditPackaging: () => void;
  onCreateStoragePreset: () => void;
};

function Pill({
  children,
  tone = 'slate'
}: {
  children: string;
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber';
}) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800'
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes[tone]}`}>{children}</span>;
}

function StorageMethodItem({ item, unresolved = false }: { item: GroupedStoragePresetItem; unresolved?: boolean }) {
  const { preset, presetLevel, linkedLevel, packCount, warnings } = item;

  return (
    <article className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase text-slate-500">{preset.code}</div>
          <div className="truncate text-sm font-semibold text-slate-950">{preset.name}</div>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end">
          <Pill tone={preset.status === 'active' ? 'emerald' : 'slate'}>
            {preset.status === 'active' ? 'Active' : 'Inactive'}
          </Pill>
          {preset.isDefault ? <Pill tone="cyan">Default</Pill> : null}
          {unresolved ? <Pill tone="amber">Unlinked</Pill> : null}
        </div>
      </div>

      <dl className="mt-2 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Container</dt>
          <dd className="font-semibold text-slate-900">{presetLevel?.containerType ?? 'Not defined'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Linked pack type</dt>
          <dd className="font-semibold text-slate-900">
            {linkedLevel ? formatLevelName(linkedLevel) : presetLevel?.levelType ?? 'Not resolved'}
          </dd>
        </div>
        {packCount?.countText ? (
          <div>
            <dt className="font-medium text-slate-500">Pack count</dt>
            <dd className="font-semibold text-slate-900">{packCount.countText.replace('Count: ', '')}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-slate-500">Total each</dt>
          <dd className="font-semibold text-slate-900">{packCount?.totalText?.replace('Total: ', '') ?? 'Not defined'}</dd>
        </div>
      </dl>

      {packCount ? (
        <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
          {packCount.countText ? <div className="font-medium text-slate-900">{packCount.countText}</div> : null}
          {packCount.totalText ? <div>{packCount.totalText}</div> : null}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-2 space-y-1 text-xs text-amber-700">
          {warnings.map((warning) => (
            <div key={warning}>Warning: {warning}</div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PackingLevelStorageMethods({
  methods,
  canCreateStoragePreset
}: {
  methods: GroupedStoragePresetItem[];
  canCreateStoragePreset: boolean;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
        <Warehouse className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        Storage methods for this pack type
      </div>

      {methods.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {methods.map((item) => (
            <StorageMethodItem key={item.key} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold text-slate-900">No storage methods for this pack type yet.</div>
          <p className="text-xs text-slate-600">
            {canCreateStoragePreset ? 'Create a storage preset to describe how this level can be stored.' : 'Define active packaging levels first.'}
          </p>
        </div>
      )}
    </section>
  );
}

function UnlinkedStorageMethodsSection({ items }: { items: GroupedStoragePresetItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="text-sm font-semibold text-amber-950">Unlinked storage methods</div>
      <p className="mt-1 text-xs text-amber-800">
        These persisted presets are not linked to an active packaging level in the current hierarchy.
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <StorageMethodItem key={item.key} item={item} unresolved />
        ))}
      </div>
    </section>
  );
}

export function ProductPackingHierarchy({
  levels,
  storagePresets,
  isPackagingSelected = false,
  isStorageSelected = false,
  onEditPackaging,
  onCreateStoragePreset
}: ProductPackingHierarchyProps) {
  const hierarchy = derivePackagingHierarchy(levels);
  const levelsById = new Map(levels.map((level) => [level.id, level]));
  const groupedStorage = groupStoragePresetsByPackagingLevelId(storagePresets, hierarchy.entries, levels);
  const hasActiveStorablePackagingLevels = levels.some((level) => level.isActive && level.canStore);
  const linkedStorageCount = [...groupedStorage.byPackagingLevelId.values()].reduce(
    (count, items) => count + items.length,
    0
  );

  return (
    <section
      aria-current={isPackagingSelected ? 'step' : undefined}
      className={[
        'rounded-lg border p-4 transition',
        isPackagingSelected ? 'border-cyan-300 bg-cyan-50/50 ring-2 ring-cyan-100' : 'border-slate-200 bg-slate-50/70'
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
              <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
              Packaging Hierarchy
            </div>
            {isPackagingSelected ? <Pill tone="cyan">Selected</Pill> : null}
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Pack types and storage methods</h2>
          <p className="mt-1 text-xs text-slate-500">
            {hierarchy.topMessage} Relations are inferred from quantities when cleanly divisible.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditPackaging}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          Configure packaging
        </button>
      </div>

      <section
        aria-current={isStorageSelected ? 'step' : undefined}
        className={[
          'mt-3 rounded-lg border px-3 py-2 transition',
          isStorageSelected ? 'border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-100' : 'border-slate-200 bg-white/80'
        ].join(' ')}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                <Warehouse className="h-3.5 w-3.5" aria-hidden="true" />
                Storage Presets
              </div>
              {isStorageSelected ? <Pill tone="cyan">Selected</Pill> : null}
              <Pill tone={linkedStorageCount > 0 ? 'emerald' : 'slate'}>{`${linkedStorageCount} linked`}</Pill>
              {groupedStorage.unlinked.length > 0 ? <Pill tone="amber">{`${groupedStorage.unlinked.length} unlinked`}</Pill> : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Storage appears under the pack type it belongs to when the link is active and resolved.</p>
          </div>
          <button
            type="button"
            onClick={onCreateStoragePreset}
            disabled={!hasActiveStorablePackagingLevels}
            className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Create storage preset
          </button>
        </div>
        {!hasActiveStorablePackagingLevels ? <p className="mt-2 text-xs text-amber-700">Define active packaging levels first.</p> : null}
      </section>

      {hierarchy.entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4">
          <div className="text-sm font-semibold text-slate-900">No packaging levels defined yet.</div>
          <p className="mt-1 text-sm text-slate-600">
            Packaging levels define how this product exists as EA, inner packs, cartons, or master cases.
          </p>
          <button
            type="button"
            onClick={onEditPackaging}
            className="mt-3 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
          >
            Configure packaging
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {hierarchy.entries.map((entry, index) => {
            const level = levelsById.get(entry.id);
            if (!level) return null;

            const storageMethods = groupedStorage.byPackagingLevelId.get(level.id) ?? [];

            return (
              <div key={entry.id} className="relative">
                {index > 0 ? <div className="absolute -top-2.5 left-3.5 h-2.5 border-l border-slate-300" aria-hidden="true" /> : null}
                <div className="flex gap-2">
                  <div className="flex w-7 shrink-0 justify-center pt-4">
                    <div className="relative h-full min-h-8 border-l border-slate-300" aria-hidden="true">
                      <div
                        className={[
                          'absolute -left-[7px] top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-white',
                          level.isActive ? 'border-cyan-300' : 'border-slate-300'
                        ].join(' ')}
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1" style={{ marginLeft: `${Math.min(entry.indent, 3) * 12}px` }}>
                    <PackagingLevelCard level={level} hierarchyEntry={entry}>
                      {level.isActive && level.canStore ? (
                        <PackingLevelStorageMethods
                          methods={storageMethods}
                          canCreateStoragePreset={hasActiveStorablePackagingLevels}
                        />
                      ) : storageMethods.length > 0 ? (
                        <PackingLevelStorageMethods
                          methods={storageMethods}
                          canCreateStoragePreset={hasActiveStorablePackagingLevels}
                        />
                      ) : null}
                    </PackagingLevelCard>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UnlinkedStorageMethodsSection items={groupedStorage.unlinked} />
    </section>
  );
}
