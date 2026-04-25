import type { Product, ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import {
  formatClassName,
  formatDimensions,
  formatNullable,
  formatWeight,
  getUnitProfileWarnings
} from './unit-profile-formatters';

type ProductFactsCardProps = {
  product: Product;
  unitProfile: ProductUnitProfile | null | undefined;
  packagingLevels: ProductPackagingLevel[];
  storagePresetCount: number;
  onEditProductFacts: () => void;
};

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function ProductFactsCard({
  product,
  unitProfile,
  packagingLevels,
  storagePresetCount,
  onEditProductFacts
}: ProductFactsCardProps) {
  const baseLevel = packagingLevels.find((level) => level.isBase) ?? null;
  const warnings = getUnitProfileWarnings({ unitProfile, packagingLevels, storagePresetCount });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-slate-500">Product Facts</div>
          <h2 className="mt-1 truncate text-base font-semibold text-slate-950">{product.name}</h2>
          <div className="mt-1 text-xs text-slate-500">
            {product.sku ?? 'SKU not defined'} | {product.externalProductId}
          </div>
        </div>
        <button
          type="button"
          onClick={onEditProductFacts}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit facts
        </button>
      </div>

      <dl className="mt-3">
        <FactRow label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
        <FactRow label="Base unit" value={baseLevel ? `${baseLevel.name} (${baseLevel.code.toUpperCase()})` : 'Not defined'} />
        <FactRow label="Base weight" value={formatWeight(unitProfile?.unitWeightG)} />
        <FactRow
          label="Base dimensions"
          value={formatDimensions({
            widthMm: unitProfile?.unitWidthMm,
            heightMm: unitProfile?.unitHeightMm,
            depthMm: unitProfile?.unitDepthMm
          })}
        />
        <FactRow label="Size class" value={formatClassName(unitProfile?.sizeClass)} />
        <FactRow label="Weight class" value={formatClassName(unitProfile?.weightClass)} />
        <FactRow label="Product code" value={formatNullable(product.sku ?? product.externalProductId)} />
      </dl>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-amber-900">Warnings</div>
            <button
              type="button"
              onClick={onEditProductFacts}
              className="rounded-md bg-amber-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-800"
            >
              Edit facts
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {warnings.map((warning) => (
              <span key={warning} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {warning}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
