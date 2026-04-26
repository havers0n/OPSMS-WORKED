import type { ReactNode } from 'react';
import { Barcode, Box, CircleAlert, Layers3, Ruler, Scale3D } from 'lucide-react';
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

function Metric({
  icon: Icon,
  label,
  value,
  missing = false
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div
      className={[
        'inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1',
        missing ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-xs font-semibold">{value}</span>
    </div>
  );
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
  const dimensions = formatDimensions({ widthMm: level.packWidthMm, heightMm: level.packHeightMm, depthMm: level.packDepthMm });
  const weight = formatWeight(level.packWeightG);
  const warnings = [
    level.packWidthMm === null || level.packHeightMm === null || level.packDepthMm === null ? 'Missing dimensions' : null,
    level.packWeightG === null ? 'Missing gross weight' : null,
    level.barcode === null ? 'Missing barcode' : null
  ].filter((warning): warning is string => warning !== null);

  return (
    <article className="relative rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-2">
          <div
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              level.isBase ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-slate-50 text-slate-600'
            ].join(' ')}
          >
            {level.isBase ? (
              <Box className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Layers3 className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase text-slate-500">{level.code}</span>
              <Badge tone={level.isActive ? 'emerald' : 'slate'}>{level.isActive ? 'Active' : 'Inactive'}</Badge>
              {level.isBase ? <Badge tone="cyan">Base</Badge> : null}
            </div>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-950">{level.name}</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 lg:justify-end">
          {level.isDefaultPickUom ? <Badge tone="cyan">Default Pick</Badge> : null}
          {level.canPick ? <Badge>Can Pick</Badge> : null}
          {level.canStore ? <Badge>Can Store</Badge> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-2.5 py-1.5 text-xs text-cyan-900">
          <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-800">
            {level.baseUnitQty} EA
          </span>
          <span className="min-w-0 truncate font-semibold">{formatRelationship(level, hierarchyEntry)}</span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <Metric icon={Ruler} label="Dims" value={dimensions} missing={dimensions === 'Not defined'} />
          <Metric icon={Scale3D} label="Weight" value={weight} missing={weight === 'Not defined'} />
          <Metric icon={Barcode} label="Barcode" value={level.barcode ?? 'Not defined'} missing={level.barcode === null} />
        </div>
      </div>

      {hierarchyEntry?.hint ? <div className="mt-2 text-xs text-amber-700">{hierarchyEntry.hint}</div> : null}

      {warnings.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <CircleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          {warnings.map((warning) => (
            <Badge key={warning} tone="amber">{warning}</Badge>
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-3 border-t border-slate-100 pt-3">{children}</div> : null}
    </article>
  );
}
