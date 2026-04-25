import type { Product, StoragePreset } from '@wos/domain';
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
  const showResults = productSearch.trim().length > 0 && !selectedProduct;
  const activePresets = presets.filter((preset) => preset.status === 'active' && preset.profileType === 'storage');
  const canSubmit = Boolean(locationId) && Boolean(selectedProduct) && Boolean(selectedPresetId) && !isSubmitting;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label="Create container from preset">
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Cancel create from preset"
        >
          Cancel
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">Create from preset</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Product</label>
          <input
            type="text"
            value={productSearch}
            onChange={(event) => onProductSearchChange(event.target.value)}
            disabled={isSubmitting}
            placeholder="Search by name or SKU..."
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Product search"
          />
          {showResults && searchResults.length > 0 ? (
            <ul className="max-h-36 overflow-y-auto rounded border border-gray-200 bg-white shadow-sm" role="listbox" aria-label="Product search results">
              {searchResults.slice(0, 10).map((product) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => onProductSelect(product)}
                  className="flex cursor-pointer items-baseline gap-2 px-3 py-2 text-xs hover:bg-blue-50"
                >
                  <span className="font-mono text-gray-500">{product.sku}</span>
                  <span className="truncate text-gray-700">{product.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedProduct ? (
            <div className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
              <span className="font-mono">{selectedProduct.sku}</span>
              {selectedProduct.name ? <span className="ml-1.5">{selectedProduct.name}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Storage preset</label>
          <select
            value={selectedPresetId}
            onChange={(event) => onPresetChange(event.target.value)}
            disabled={isSubmitting || !selectedProduct || isLoadingPresets}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
            aria-label="Storage preset"
          >
            <option value="">{isLoadingPresets ? 'Loading presets...' : 'Select preset'}</option>
            {activePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.code} - {preset.name}
              </option>
            ))}
          </select>
          {selectedProduct && !isLoadingPresets && activePresets.length === 0 ? (
            <p className="text-xs text-amber-700">No active storage presets for this product.</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            External code <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={externalCode}
            onChange={(event) => onExternalCodeChange(event.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. PLT-0042"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="External code"
          />
        </div>

        <fieldset className="space-y-2 rounded border border-gray-200 px-3 py-2">
          <legend className="px-1 text-xs font-medium text-gray-700">Preset mode</legend>
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
              <span className="block font-medium">Create empty preset shell</span>
              <span className="text-gray-500">Creates a standard container with the preset reference only.</span>
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
              <span className="block font-medium">Create and fill standard contents</span>
              <span className="text-gray-500">Initial contents are created only by backend receipt logic.</span>
            </span>
          </label>
        </fieldset>

        {!locationId ? <p className="text-xs text-gray-400">Resolving location...</p> : null}
        {errorMessage ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{errorMessage}</p>
        ) : null}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Confirm create from preset"
          data-testid="confirm-create-from-preset"
        >
          {isSubmitting ? 'Creating...' : 'Create from preset'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
