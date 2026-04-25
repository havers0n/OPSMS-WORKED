import type { ProductPackagingLevel } from '@wos/domain';
import type { PackagingHierarchyEntry } from './packaging-hierarchy';
import { formatDimensions, formatWeight } from './unit-profile-formatters';

type PackagingLevelCardProps = {
  level: ProductPackagingLevel;
  hierarchyEntry: PackagingHierarchyEntry | null;
};

function Badge({ children, tone = 'slate' }: { children: string; tone?: 'slate' | 'cyan' | 'emerald' | 'amber' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    cyan: 'bg-cyan-100 text-cyan-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800'
  };

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${classes[tone]}`}>{children}</span>;
}

export function PackagingLevelCard({ level, hierarchyEntry }: PackagingLevelCardProps) {
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
          <span className="font-medium text-slate-900">{level.baseUnitQty} EA</span>
          {hierarchyEntry?.nestedCount && hierarchyEntry.nestedChildLabel ? (
            <span> | inferred: {hierarchyEntry.nestedCount} x {hierarchyEntry.nestedChildLabel}</span>
          ) : (
            <span> | base unit quantity</span>
          )}
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
    </article>
  );
}
