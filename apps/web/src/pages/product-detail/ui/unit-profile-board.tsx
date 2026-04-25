import type { Product, ProductPackagingLevel, ProductUnitProfile, StoragePreset } from '@wos/domain';
import { ProductPackingHierarchy } from './product-packing-hierarchy';
import { ProductFactsCard } from './product-facts-card';

export type UnitProfileWorkspaceSelection = 'product-facts' | 'packaging' | 'storage' | null;

type UnitProfileBoardProps = {
  product: Product;
  unitProfile: ProductUnitProfile | null | undefined;
  packagingLevels: ProductPackagingLevel[];
  storagePresets: StoragePreset[];
  selectedArea?: UnitProfileWorkspaceSelection;
  onEditProductFacts: () => void;
  onEditPackaging: () => void;
  onCreateStoragePreset: () => void;
};

export function UnitProfileBoard({
  product,
  unitProfile,
  packagingLevels,
  storagePresets,
  selectedArea = null,
  onEditProductFacts,
  onEditPackaging,
  onCreateStoragePreset
}: UnitProfileBoardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-100/70 p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Unit Profile Board</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Product facts flow into packaging hierarchy, then into storage presets.
          </p>
        </div>
        <div className="text-xs font-medium text-slate-500">Product Facts - Packaging Hierarchy - Storage Presets</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <ProductFactsCard
          product={product}
          unitProfile={unitProfile}
          packagingLevels={packagingLevels}
          storagePresetCount={storagePresets.length}
          isSelected={selectedArea === 'product-facts'}
          onEditProductFacts={onEditProductFacts}
        />
        <ProductPackingHierarchy
          levels={packagingLevels}
          storagePresets={storagePresets}
          isPackagingSelected={selectedArea === 'packaging'}
          isStorageSelected={selectedArea === 'storage'}
          onEditPackaging={onEditPackaging}
          onCreateStoragePreset={onCreateStoragePreset}
        />
      </div>
    </section>
  );
}
