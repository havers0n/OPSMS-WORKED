import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import { derivePackagingHierarchy } from './packaging-hierarchy';
import { PackagingLevelCard } from './packaging-level-card';

type PackagingHierarchyPanelProps = {
  levels: ProductPackagingLevel[];
  unitProfile: ProductUnitProfile | null;
  onEditPackaging: () => void;
};

export function PackagingHierarchyPanel({ levels, unitProfile, onEditPackaging }: PackagingHierarchyPanelProps) {
  const hierarchy = derivePackagingHierarchy(levels);
  const levelsById = new Map(levels.map((level) => [level.id, level]));
  const hasUnitProfile = unitProfile !== null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Packaging Hierarchy</div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Pack types</h2>
          <p className="mt-1 text-xs text-slate-500">
            {hierarchy.topMessage} Relations are inferred from quantities when cleanly divisible.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditPackaging}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Configure packaging
        </button>
      </div>

      {hierarchy.entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4">
          <div className="text-sm font-semibold text-slate-900">No packaging levels defined yet.</div>
          <p className="mt-1 text-sm text-slate-600">
            Packaging levels define how this product is picked, packed, and stored.
          </p>
          {!hasUnitProfile ? (
            <p className="mt-1 text-xs text-amber-700">
              Product facts are still missing, but packaging can be configured with the existing flow.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onEditPackaging}
            className="mt-3 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
          >
            Configure packaging
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {hierarchy.entries.map((entry, index) => {
            const level = levelsById.get(entry.id);
            if (!level) return null;

            return (
              <div key={entry.id} className="relative">
                {index > 0 ? <div className="absolute -top-3 left-5 h-3 border-l border-slate-300" aria-hidden="true" /> : null}
                <div className="flex gap-3">
                  <div className="flex w-10 shrink-0 justify-center pt-5">
                    <div className="h-full min-h-10 border-l border-slate-300" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1" style={{ marginLeft: `${Math.min(entry.indent, 3) * 12}px` }}>
                    <PackagingLevelCard level={level} hierarchyEntry={entry} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
