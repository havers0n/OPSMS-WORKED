import type { Product, StoragePreset } from '@wos/domain';
import { useT } from '@/shared/i18n';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

type CreateContainerFromPresetTaskPanelProps = {
  productSearch: string;
  selectedProduct: Product | null;
  searchResults: Product[];
  presets: StoragePreset[];
  selectedPresetId: string;
  externalCode: string;
  materializeContents: boolean;
  isLoadingPresets: boolean;
  isSubmitting: boolean;
  locationId: string | null;
  errorMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onProductSearchChange: (value: string) => void;
  onProductSelect: (product: Product) => void;
  onPresetChange: (presetId: string) => void;
  onExternalCodeChange: (value: string) => void;
  onMaterializeContentsChange: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CreateContainerFromPresetTaskPanel({
  productSearch,
  selectedProduct,
  searchResults,
  presets,
  selectedPresetId,
  externalCode,
  materializeContents,
  isLoadingPresets,
  isSubmitting,
  locationId,
  errorMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onProductSearchChange,
  onProductSelect,
  onPresetChange,
  onExternalCodeChange,
  onMaterializeContentsChange,
  onConfirm,
  onCancel
}: CreateContainerFromPresetTaskPanelProps) {
  const t = useT();
  const showResults = productSearch.trim().length > 0 && !selectedProduct;
  const activePresets = presets.filter((preset) => preset.status === 'active' && preset.profileType === 'storage');
  const canSubmit = Boolean(locationId) && Boolean(selectedProduct) && Boolean(selectedPresetId) && !isSubmitting;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label={t('storage.action.createFromPreset')}>
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label={t('storage.action.cancelCreateFromPreset')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">{t('storage.action.createFromPreset')}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">{t('storage.field.product')}</label>
          <input
            type="text"
            value={productSearch}
            onChange={(event) => onProductSearchChange(event.target.value)}
            disabled={isSubmitting}
            placeholder={t('storage.placeholder.searchNameOrSku')}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.product')}
          />
          {showResults && searchResults.length > 0 ? (
            <ul className="max-h-36 overflow-y-auto rounded border border-gray-200 bg-white shadow-sm" role="listbox" aria-label={t('storage.field.product')}>
              {searchResults.slice(0, 10).map((product) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => onProductSelect(product)}
                  className="flex cursor-pointer items-baseline gap-2 px-3 py-2 text-xs hover:bg-blue-50"
                >
                  <span className="font-mono text-gray-500" dir="ltr">{product.sku}</span>
                  <span className="truncate text-gray-700">{product.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedProduct ? (
            <div className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
              <span className="font-mono" dir="ltr">{selectedProduct.sku}</span>
              {selectedProduct.name ? <span className="ms-1.5">{selectedProduct.name}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">{t('storage.field.storagePreset')}</label>
          <select
            value={selectedPresetId}
            onChange={(event) => onPresetChange(event.target.value)}
            disabled={isSubmitting || !selectedProduct || isLoadingPresets}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label={t('storage.field.storagePreset')}
          >
            <option value="">{isLoadingPresets ? t('storage.placeholder.loadingPresets') : t('storage.placeholder.selectPreset')}</option>
            {activePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.code} - {preset.name}
              </option>
            ))}
          </select>
          {selectedProduct && !isLoadingPresets && activePresets.length === 0 ? (
            <p className="text-xs text-amber-700">{t('storage.preset.noActiveForProduct')}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            {t('storage.field.externalCode')} <span className="text-gray-400">({t('storage.field.optional')})</span>
          </label>
          <input
            type="text"
            value={externalCode}
            onChange={(event) => onExternalCodeChange(event.target.value)}
            disabled={isSubmitting}
            placeholder={t('storage.placeholder.externalCodeExample')}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.externalCode')}
            dir="ltr"
          />
        </div>

        <fieldset className="space-y-2 rounded border border-gray-200 px-3 py-2">
          <legend className="px-1 text-xs font-medium text-gray-700">{t('storage.field.presetMode')}</legend>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="radio"
              name="create-from-preset-mode"
              checked={!materializeContents}
              onChange={() => onMaterializeContentsChange(false)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">{t('storage.preset.emptyShell')}</span>
              <span className="text-gray-500">{t('storage.preset.emptyShellDescription')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="radio"
              name="create-from-preset-mode"
              checked={materializeContents}
              onChange={() => onMaterializeContentsChange(true)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">{t('storage.preset.materializeContents')}</span>
              <span className="text-gray-500">{t('storage.preset.materializeContentsDescription')}</span>
            </span>
          </label>
        </fieldset>

        {!locationId ? <p className="text-xs text-gray-400">{t('storage.state.resolvingLocation')}</p> : null}
        {errorMessage ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{errorMessage}</p>
        ) : null}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('storage.action.confirmCreateFromPreset')}
          data-testid="confirm-create-from-preset"
        >
          {isSubmitting ? t('storage.action.creating') : t('storage.action.createFromPreset')}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {t('storage.action.cancel')}
        </button>
      </div>
    </div>
  );
}
