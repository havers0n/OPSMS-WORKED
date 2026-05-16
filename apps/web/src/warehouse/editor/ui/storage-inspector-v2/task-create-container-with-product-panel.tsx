import type { ContainerType, Product } from '@wos/domain';
import { useT } from '@/shared/i18n';
import {
  ContainerTypeSelect,
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface CreateContainerWithProductTaskPanelProps {
  containerTypes: ContainerType[];
  containerTypeId: string;
  externalCode: string;
  productSearch: string;
  selectedProduct: Product | null;
  searchResults: Product[];
  quantity: string;
  uom: string;
  isSubmitting: boolean;
  locationId: string | null;
  errorMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onContainerTypeChange: (id: string) => void;
  onExternalCodeChange: (value: string) => void;
  onProductSearchChange: (value: string) => void;
  onProductSelect: (product: Product) => void;
  onQuantityChange: (value: string) => void;
  onUomChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateContainerWithProductTaskPanel({
  containerTypes,
  containerTypeId,
  externalCode,
  productSearch,
  selectedProduct,
  searchResults,
  quantity,
  uom,
  isSubmitting,
  locationId,
  errorMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onContainerTypeChange,
  onExternalCodeChange,
  onProductSearchChange,
  onProductSelect,
  onQuantityChange,
  onUomChange,
  onConfirm,
  onCancel
}: CreateContainerWithProductTaskPanelProps) {
  const t = useT();
  const showResults = productSearch.trim().length > 0 && !selectedProduct;
  const canSubmit =
    Boolean(containerTypeId) &&
    Boolean(locationId) &&
    selectedProduct !== null &&
    quantity.trim() !== '' &&
    Number(quantity) > 0 &&
    uom.trim() !== '' &&
    !isSubmitting;

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.action.createContainerWithProduct')}
    >
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label={t('storage.action.cancelCreateContainerWithProduct')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">{t('storage.action.createContainerWithProduct')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <ContainerTypeSelect
          containerTypes={containerTypes}
          value={containerTypeId}
          onChange={onContainerTypeChange}
          disabled={isSubmitting}
        />
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
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.externalCode')}
            dir="ltr"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            {t('storage.field.product')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productSearch}
            onChange={(event) => onProductSearchChange(event.target.value)}
            disabled={isSubmitting}
            placeholder={t('storage.placeholder.searchNameOrSku')}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.product')}
          />
          {showResults && searchResults.length > 0 && (
            <ul className="border border-gray-200 rounded bg-white shadow-sm max-h-36 overflow-y-auto" role="listbox" aria-label={t('storage.field.product')}>
              {searchResults.slice(0, 10).map((product) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => onProductSelect(product)}
                  className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 flex items-baseline gap-2"
                >
                  <span className="font-mono text-gray-500" dir="ltr">{product.sku}</span>
                  <span className="text-gray-700 truncate">{product.name}</span>
                </li>
              ))}
            </ul>
          )}
          {selectedProduct && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
              <span className="font-mono" dir="ltr">{selectedProduct.sku}</span>
              {selectedProduct.name && <span className="ms-1.5">{selectedProduct.name}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {t('storage.field.quantity')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              disabled={isSubmitting}
              placeholder={t('storage.placeholder.zero')}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label={t('storage.field.quantity')}
            />
          </div>
          <div className="w-24 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {t('storage.field.uom')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={uom}
              onChange={(event) => onUomChange(event.target.value)}
              disabled={isSubmitting}
              placeholder="EA"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label={t('storage.field.uom')}
            />
          </div>
        </div>

        {!locationId && <p className="text-xs text-gray-400">{t('storage.state.resolvingLocation')}</p>}

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('storage.action.confirmCreateContainerWithProduct')}
        >
          {isSubmitting ? t('storage.action.creating') : t('storage.action.createContainer')}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {t('storage.action.cancel')}
        </button>
      </div>
    </div>
  );
}
