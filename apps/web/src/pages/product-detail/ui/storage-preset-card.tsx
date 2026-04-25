import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { formatLevelName } from './unit-profile-formatters';

type StoragePresetCardProps = {
  preset: StoragePreset;
  packagingLevels: ProductPackagingLevel[];
};

function resolveLevel(levels: ProductPackagingLevel[], legacyId: string | null, levelType: string) {
  return (
    levels.find((level) => legacyId !== null && level.id === legacyId) ??
    levels.find((level) => level.code.toLowerCase() === levelType.toLowerCase()) ??
    null
  );
}

function formatPackCount(qtyEach: number, packagingLevel: ProductPackagingLevel | null) {
  if (!packagingLevel) {
    return {
      countText: null,
      totalText: `Total: ${qtyEach} EA`,
      warning: 'Linked packaging level could not be resolved.'
    };
  }

  if (qtyEach % packagingLevel.baseUnitQty !== 0) {
    return {
      countText: null,
      totalText: `Total: ${qtyEach} EA`,
      warning: `Does not divide cleanly by ${packagingLevel.name} size ${packagingLevel.baseUnitQty} EA.`
    };
  }

  return {
    countText: `Count: ${qtyEach / packagingLevel.baseUnitQty} ${packagingLevel.name}`,
    totalText: `Total: ${qtyEach} EA`,
    warning: null
  };
}

export function StoragePresetCard({ preset, packagingLevels }: StoragePresetCardProps) {
  const firstLevel = preset.levels[0] ?? null;
  const resolvedLevel = firstLevel
    ? resolveLevel(packagingLevels, firstLevel.legacyProductPackagingLevelId, firstLevel.levelType)
    : null;
  const packCount = firstLevel ? formatPackCount(firstLevel.qtyEach, resolvedLevel) : null;
  const warnings = [
    !firstLevel ? 'No composition levels' : null,
    firstLevel && !firstLevel.containerType ? 'Missing container type' : null,
    packCount?.warning ?? null
  ].filter((warning): warning is string => warning !== null);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold uppercase text-slate-500">{preset.code}</div>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-950">{preset.name}</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {preset.status === 'active' ? 'Active' : 'Inactive'}
          </span>
          {preset.isDefault ? (
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-medium text-cyan-800">Default</span>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Container</dt>
          <dd className="font-medium text-slate-900">{firstLevel?.containerType ?? 'Not defined'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Linked pack type</dt>
          <dd className="text-right font-medium text-slate-900">
            {resolvedLevel ? formatLevelName(resolvedLevel) : firstLevel?.levelType ?? 'Not resolved'}
          </dd>
        </div>
        {packCount?.countText ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pack count</dt>
            <dd className="font-medium text-slate-900">{packCount.countText.replace('Count: ', '')}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Total each</dt>
          <dd className="font-medium text-slate-900">{packCount?.totalText.replace('Total: ', '') ?? 'Not defined'}</dd>
        </div>
      </dl>

      {packCount ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {packCount.countText ? <div className="font-medium text-slate-900">{packCount.countText}</div> : null}
          <div>{packCount.totalText}</div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-amber-700">
          {warnings.map((warning) => (
            <div key={warning}>Warning: {warning}</div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
