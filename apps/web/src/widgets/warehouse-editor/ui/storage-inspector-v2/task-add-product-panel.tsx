import type { Product } from '@wos/domain';
import { TaskPanelBreadcrumb } from './shared';

export interface AddProductToContainerTaskPanelProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  containerDisplayCode: string;
  isContainerEmpty: boolean;
  locationId: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  productSearch: string;
  selectedProduct: Product | null;
  searchResults: Product[];
  quantity: string;
  uom: string;
  onProductSearchChange: (value: string) => void;
  onProductSelect: (product: Product) => void;
  onQuantityChange: (value: string) => void;
  onUomChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AddProductToContainerTaskPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  containerDisplayCode,
  isContainerEmpty,
  locationId,
  isSubmitting,
  errorMessage,
  productSearch,
  selectedProduct,
  searchResults,
  quantity,
  uom,
  onProductSearchChange,
  onProductSelect,
  onQuantityChange,
  onUomChange,
  onConfirm,
  onCancel
}: AddProductToContainerTaskPanelProps) {
  const showResults = productSearch.trim().length > 0 && !selectedProduct;
  const quantityNumber = Number(quantity);
  const canSubmit =
    isContainerEmpty &&
    selectedProduct !== null &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0 &&
    uom.trim().length > 0 &&
    !isSubmitting;

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Add product to container"
      data-testid="task-add-product-to-container-panel"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel add product to container"
        >
          ← Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">Add product to {containerDisplayCode}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!isContainerEmpty && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            This container is no longer empty. Return to container details.
          </p>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Product <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productSearch}
            onChange={(event) => onProductSearchChange(event.target.value)}
            disabled={isSubmitting}
            placeholder="Search by name or SKU…"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Add product search"
          />
          {showResults && searchResults.length > 0 && (
            <ul
              className="border border-gray-200 rounded bg-white shadow-sm max-h-36 overflow-y-auto"
              role="listbox"
              aria-label="Add product search results"
            >
              {searchResults.slice(0, 10).map((product) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => onProductSelect(product)}
                  className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 flex items-baseline gap-2"
                >
                  <span className="font-mono text-gray-500">{product.sku}</span>
                  <span className="text-gray-700 truncate">{product.name}</span>
                </li>
              ))}
            </ul>
          )}
          {selectedProduct && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
              <span className="font-mono">{selectedProduct.sku}</span>
              {selectedProduct.name && <span className="ml-1.5">{selectedProduct.name}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              disabled={isSubmitting}
              placeholder="0"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label="Add product quantity"
            />
          </div>
          <div className="w-24 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              UOM <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={uom}
              onChange={(event) => onUomChange(event.target.value)}
              disabled={isSubmitting}
              placeholder="EA"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label="Add product uom"
            />
          </div>
        </div>

        {!locationId && <p className="text-xs text-gray-400">Resolving location…</p>}

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Confirm add product to container"
        >
          {isSubmitting ? 'Adding…' : 'Add product'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
