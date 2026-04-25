import { ArrowLeft, RefreshCw } from 'lucide-react';
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
            createStoragePresetMutation={model.createStoragePresetMutation}
          />
        </div>
      </div>
    </section>
  );
}
