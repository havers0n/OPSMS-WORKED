import type { ReactNode } from 'react';
import type { ProductPackagingLevel } from '@wos/domain';
import type { PackagingHierarchyEntry } from './packaging-hierarchy';
import { formatDimensions, formatWeight } from './unit-profile-formatters';

type PackagingLevelCardProps = {
  level: ProductPackagingLevel;
  hierarchyEntry: PackagingHierarchyEntry | null;
  children?: ReactNode;
};

function Badge({
  children,
  tone = 'slate'
}: {
  children: string;
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber' | 'rose';
}) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    cyan: 'bg-cyan-100 text-cyan-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800'
  };

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${classes[tone]}`}>{children}</span>;
}

function formatRelationship(level: ProductPackagingLevel, hierarchyEntry: PackagingHierarchyEntry | null) {
  if (level.isBase || level.baseUnitQty === 1) {
    return '1 single unit';
  }

  if (hierarchyEntry?.nestedCount && hierarchyEntry.nestedChildLabel) {
    return `Contains: ${hierarchyEntry.nestedCount} ${hierarchyEntry.nestedChildLabel} / ${level.baseUnitQty} EA inferred`;
  }

  return `Base unit quantity: ${level.baseUnitQty} EA`;
}

export function PackagingLevelCard({ level, hierarchyEntry, children }: PackagingLevelCardProps) {
  const warnings = [
    level.packWidthMm === null || level.packHeightMm === null || level.packDepthMm === null ? 'Missing dimensions' : null,
    level.packWeightG === null ? 'Missing gross weight' : null,
    level.barcode === null ? 'Missing barcode' : null
  ].filter((warning): warning is string => warning !== null);

  return (
    <article className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs font-semibold uppercase text-slate-500">{level.code}</div>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-950">{level.name}</h3>
        </div>
        <Badge tone={level.isActive ? 'emerald' : 'slate'}>{level.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <div>
          <span className="font-medium text-slate-900">{formatRelationship(level, hierarchyEntry)}</span>
        </div>
        <div>Dimensions: {formatDimensions({ widthMm: level.packWidthMm, heightMm: level.packHeightMm, depthMm: level.packDepthMm })}</div>
        <div>Barcode: {level.barcode ?? 'Not defined'}</div>
        <div>Gross weight: {formatWeight(level.packWeightG)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {level.isBase ? <Badge tone="cyan">Base</Badge> : null}
        {level.isDefaultPickUom ? <Badge tone="cyan">Default Pick</Badge> : null}
        {level.canPick ? <Badge>Can Pick</Badge> : null}
        {level.canStore ? <Badge>Can Store</Badge> : null}
        {!level.isActive ? <Badge tone="amber">Inactive</Badge> : null}
      </div>

      {hierarchyEntry?.hint ? <div className="mt-2 text-xs text-amber-700">{hierarchyEntry.hint}</div> : null}

      {warnings.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {warnings.map((warning) => (
            <Badge key={warning} tone="amber">{warning}</Badge>
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-3 border-t border-slate-100 pt-3">{children}</div> : null}
    </article>
  );
}
