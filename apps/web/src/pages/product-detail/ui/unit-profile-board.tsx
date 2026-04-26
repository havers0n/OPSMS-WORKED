import type { Product, ProductPackagingLevel, ProductUnitProfile, StoragePreset } from '@wos/domain';
import { ProductPackingHierarchy } from './product-packing-hierarchy';
import { ProductFactsCard } from './product-facts-card';
import type { UnitProfileDraft, UnitProfileNumericField } from './section-editing';

export type UnitProfileWorkspaceSelection = 'product-facts' | 'packaging' | 'storage' | null;

type UnitProfileBoardProps = {
  product: Product;
  unitProfile: ProductUnitProfile | null | undefined;
  packagingLevels: ProductPackagingLevel[];
  storagePresets: StoragePreset[];
  selectedArea?: UnitProfileWorkspaceSelection;
  isProductFactsEditing: boolean;
  unitProfileDraft: UnitProfileDraft;
  unitProfileFieldErrors: Partial<Record<UnitProfileNumericField, string>>;
  unitProfileSaveError: string | null;
  unitProfileDirty: boolean;
  isSavingProductFacts: boolean;
  onEditProductFacts: () => void;
  onCancelProductFactsEdit: () => void;
  onSaveProductFacts: () => void;
  onProductFactsNumericFieldChange: (field: UnitProfileNumericField, value: string) => void;
  onProductFactsClassFieldChange: (
    field: 'weightClass' | 'sizeClass',
    value: UnitProfileDraft['weightClass'] | UnitProfileDraft['sizeClass']
  ) => void;
  onEditPackaging: () => void;
  onCreateStoragePreset: () => void;
};

export function UnitProfileBoard({
  product,
  unitProfile,
  packagingLevels,
  storagePresets,
  selectedArea = null,
  isProductFactsEditing,
  unitProfileDraft,
  unitProfileFieldErrors,
  unitProfileSaveError,
  unitProfileDirty,
  isSavingProductFacts,
  onEditProductFacts,
  onCancelProductFactsEdit,
  onSaveProductFacts,
  onProductFactsNumericFieldChange,
  onProductFactsClassFieldChange,
  onEditPackaging,
  onCreateStoragePreset
}: UnitProfileBoardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">Unit Profile</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <ProductFactsCard
          product={product}
          unitProfile={unitProfile}
          packagingLevels={packagingLevels}
          storagePresetCount={storagePresets.length}
          isSelected={selectedArea === 'product-facts'}
          isEditing={isProductFactsEditing}
          unitProfileDraft={unitProfileDraft}
          unitProfileFieldErrors={unitProfileFieldErrors}
          unitProfileSaveError={unitProfileSaveError}
          unitProfileDirty={unitProfileDirty}
          isSaving={isSavingProductFacts}
          onEditProductFacts={onEditProductFacts}
          onCancelEdit={onCancelProductFactsEdit}
          onSaveEdit={onSaveProductFacts}
          onNumericFieldChange={onProductFactsNumericFieldChange}
          onClassFieldChange={onProductFactsClassFieldChange}
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
