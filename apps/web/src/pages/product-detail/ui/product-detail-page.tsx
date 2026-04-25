import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { routes } from '@/shared/config/routes';
import {
  getProfileCompleteness,
  useProductDetailPageModel
} from '../model/use-product-detail-page-model';
import { ProductMediaSection } from './product-media-section';
import { ProductPackagingSection } from './product-packaging-section';
import { ProductStoragePresetsSection } from './product-storage-presets-section';
import { ProductUnitProfileSection } from './product-unit-profile-section';
import { UnitProfileBoard } from './unit-profile-board';

function getUnitProfileSetupStatus(profile: ReturnType<typeof useProductDetailPageModel>['unitProfileQuery']['data']) {
  if (!profile) return { label: 'Missing', detail: 'No profile data' };

  const hasExactMeasurements =
    profile.unitWeightG !== null &&
    profile.unitWidthMm !== null &&
    profile.unitHeightMm !== null &&
    profile.unitDepthMm !== null;
  const hasAnyProfileData =
    profile.unitWeightG !== null ||
    profile.unitWidthMm !== null ||
    profile.unitHeightMm !== null ||
    profile.unitDepthMm !== null ||
    profile.weightClass !== null ||
    profile.sizeClass !== null;

  if (hasExactMeasurements) return { label: 'Ready', detail: 'Exact measurements set' };
  if (hasAnyProfileData) return { label: 'Partial', detail: 'Some profile data set' };
  return { label: 'Missing', detail: 'No profile data' };
}

function getStatusClasses(label: string) {
  if (label === 'Ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (label === 'Blocked' || label === 'Missing' || label === 'No storable levels') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-slate-200 bg-white text-slate-700';
}

type ProductSetupFlowStripProps = {
  unitProfile: ReturnType<typeof useProductDetailPageModel>['unitProfileQuery']['data'];
  packagingLevels: ReturnType<typeof useProductDetailPageModel>['packagingLevelsQuery']['data'];
  storagePresets: ReturnType<typeof useProductDetailPageModel>['storagePresetsQuery']['data'];
};

export function ProductSetupFlowStrip({
  unitProfile,
  packagingLevels,
  storagePresets
}: ProductSetupFlowStripProps) {
  const levels = packagingLevels ?? [];
  const storableLevelCount = levels.filter((level) => level.isActive && level.canStore).length;
  const presetCount = storagePresets?.length ?? 0;
  const unitStatus = getUnitProfileSetupStatus(unitProfile);
  const packagingStatus =
    levels.length === 0
      ? { label: 'Missing', detail: 'No levels yet' }
      : storableLevelCount === 0
        ? { label: 'No storable levels', detail: `${levels.length} ${levels.length === 1 ? 'level' : 'levels'}` }
        : {
            label: 'Ready',
            detail: `${levels.length} ${levels.length === 1 ? 'level' : 'levels'}, ${storableLevelCount} storable`
          };
  const storageStatus =
    storableLevelCount === 0
      ? { label: 'Blocked', detail: 'Needs storable pack type' }
      : presetCount === 0
        ? { label: 'Not set', detail: 'No presets yet' }
        : { label: 'Ready', detail: `${presetCount} ${presetCount === 1 ? 'preset' : 'presets'}` };
  const steps = [
    { number: 1, title: 'Single Unit Profile', status: unitStatus },
    { number: 2, title: 'Packaging Levels', status: packagingStatus },
    { number: 3, title: 'Storage Presets', status: storageStatus }
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Product setup flow</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Define the unit, create pack types from it, then use storable pack types in storage presets.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        {steps.map((step, index) => (
          <div key={step.title} className="contents">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  {step.number}
                </span>
                <span className="text-xs font-semibold text-slate-900">{step.title}</span>
                <span
                  className={[
                    'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    getStatusClasses(step.status.label)
                  ].join(' ')}
                >
                  {step.status.label}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{step.status.detail}</div>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight className="hidden h-4 w-4 text-slate-300 lg:block" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo =
    typeof (location.state as { from?: string } | null)?.from === 'string'
      ? ((location.state as { from: string }).from ?? routes.products)
      : routes.products;

  const model = useProductDetailPageModel(productId ?? null);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(returnTo);
  }

  if (!productId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">Invalid product ID.</p>
          <Link
            to={routes.products}
            className="mt-3 inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  if (model.productQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  if (model.isNotFound) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Product not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The requested product does not exist or is no longer available.
          </p>
          <Link
            to={routes.products}
            className="mt-4 inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  if (model.productQuery.isError || !model.product) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Unable to load product</h1>
          <p className="mt-2 text-sm text-slate-600">
            {model.productQuery.error instanceof Error
              ? model.productQuery.error.message
              : 'Unexpected error while loading product detail.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void model.productQuery.refetch()}
              className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
            <Link
              to={routes.products}
              className="inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-full w-full flex-1 overflow-hidden">
      <div className="m-4 flex h-full w-full flex-col overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 md:gap-4 md:p-5">
          <header className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to catalog
                </button>

                <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">{model.product.name}</h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                  <span>{model.product.sku ?? 'SKU not defined'}</span>
                  <span className="text-slate-300">|</span>
                  <span className="break-all">{model.product.externalProductId}</span>
                  <span className="text-slate-300">|</span>
                  <span>{model.product.source}</span>
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Updated: {new Date(model.product.updatedAt).toLocaleString()}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-700">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    Status: {model.product.isActive ? 'active' : 'inactive'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    Profile: {getProfileCompleteness(model.unitProfileQuery.data)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    Packaging levels: {model.packagingLevelsQuery.data?.length ?? '-'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    Default pick UOM: {model.defaultPickLevel?.code ?? 'Not set'}
                  </span>
                </div>
              </div>

              <ProductMediaSection
                productName={model.product.name}
                displayImages={model.displayImages}
                activeImageIndex={model.activeImageIndex}
                selectedImageUrl={model.selectedImageUrl}
                lightboxOpen={model.lightboxOpen}
                onImageLoadError={model.handleImageLoadError}
                onSelectImage={model.selectImage}
                onOpenLightbox={model.openLightbox}
                onCloseLightbox={model.closeLightbox}
                onGoToPreviousImage={model.goToPreviousImage}
                onGoToNextImage={model.goToNextImage}
              />
            </div>
          </header>

          <ProductSetupFlowStrip
            unitProfile={model.unitProfileQuery.data}
            packagingLevels={model.packagingLevelsQuery.data}
            storagePresets={model.storagePresetsQuery.data}
          />

          <UnitProfileBoard
            product={model.product}
            unitProfile={model.unitProfileQuery.data}
            packagingLevels={model.packagingLevelsQuery.data ?? []}
            storagePresets={model.storagePresetsQuery.data ?? []}
            onEditUnitProfile={model.beginUnitProfileEdit}
            onEditPackaging={model.beginPackagingEdit}
          />

          <ProductUnitProfileSection
            unitProfileQuery={model.unitProfileQuery}
            upsertUnitProfileMutation={model.upsertUnitProfileMutation}
            isUnitProfileEditing={model.isUnitProfileEditing}
            unitProfileDraft={model.unitProfileDraft}
            unitProfileFieldErrors={model.unitProfileFieldErrors}
            unitProfileSaveError={model.unitProfileSaveError}
            unitProfileDirty={model.unitProfileDirty}
            onBeginEdit={model.beginUnitProfileEdit}
            onCancelEdit={model.cancelUnitProfileEdit}
            onSave={() => void model.saveUnitProfile()}
            onNumericFieldChange={model.updateUnitProfileDraftField}
            onClassFieldChange={model.updateUnitProfileDraftClassField}
          />

          <ProductPackagingSection
            packagingLevelsQuery={model.packagingLevelsQuery}
            replacePackagingLevelsMutation={model.replacePackagingLevelsMutation}
            unitProfileQuery={model.unitProfileQuery}
            isPackagingEditing={model.isPackagingEditing}
            packagingDraft={model.packagingDraft}
            packagingRowErrors={model.packagingRowErrors}
            packagingSectionErrors={model.packagingSectionErrors}
            packagingSaveError={model.packagingSaveError}
            packagingDirty={model.packagingDirty}
            packagingEditorSemantics={model.packagingEditorSemantics}
            onBeginEdit={model.beginPackagingEdit}
            onCancelEdit={model.cancelPackagingEdit}
            onSave={() => void model.savePackagingLevels()}
            onAddRow={model.addPackagingRow}
            onRemoveRow={model.removePackagingRow}
            onUpdateRow={model.updatePackagingRow}
          />

          <ProductStoragePresetsSection
            productId={productId}
            storagePresetsQuery={model.storagePresetsQuery}
            packagingLevelsQuery={model.packagingLevelsQuery}
            containerTypesQuery={model.containerTypesQuery}
            createStoragePresetMutation={model.createStoragePresetMutation}
          />
        </div>
      </div>
    </section>
  );
}
