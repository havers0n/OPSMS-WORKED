import type { Container, LocationStorageSnapshotRow } from '@wos/domain';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export type TransferSourceLine = Pick<
  LocationStorageSnapshotRow,
  'containerId' | 'inventoryUnitId' | 'product' | 'itemRef' | 'quantity' | 'uom' | 'packCount'
>;

export interface TransferToContainerTaskPanelProps {
  sourceLine: TransferSourceLine;
  containers: Container[];
  sourceContainerDisplayCode: string;
  selectedTargetContainerId: string;
  quantity: string;
  isSubmitting: boolean;
  isLoadingContainers: boolean;
  errorMessage: string | null;
  validationMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onTargetContainerChange: (containerId: string) => void;
  onQuantityChange: (quantity: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function sourceLineLabel(sourceLine: TransferSourceLine) {
  return sourceLine.product?.name ?? sourceLine.product?.sku ?? sourceLine.itemRef ?? 'Inventory line';
}

function containerLabel(container: Container) {
  return container.externalCode ?? container.systemCode;
}

export function TransferToContainerTaskPanel({
  sourceLine,
  containers,
  sourceContainerDisplayCode,
  selectedTargetContainerId,
  quantity,
  isSubmitting,
  isLoadingContainers,
  errorMessage,
  validationMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onTargetContainerChange,
  onQuantityChange,
  onConfirm,
  onCancel
}: TransferToContainerTaskPanelProps) {
  const availableContainers = containers.filter(
    (container) => container.status === 'active' && container.id !== sourceLine.containerId
  );
  const canSubmit = !isSubmitting && !validationMessage;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label="Transfer inventory to container">
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Cancel transfer to container"
        >
          Cancel
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">Transfer to container</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-medium text-gray-900">{sourceLineLabel(sourceLine)}</div>
          <div className="mt-1 font-mono text-[11px] text-gray-500">
            From {sourceContainerDisplayCode} / {sourceLine.quantity ?? 'unknown'} {sourceLine.uom ?? ''}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Target container <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedTargetContainerId}
            onChange={(event) => onTargetContainerChange(event.target.value)}
            disabled={isSubmitting || isLoadingContainers || availableContainers.length === 0}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Target container"
          >
            <option value="">{isLoadingContainers ? 'Loading containers...' : 'Select container...'}</option>
            {availableContainers.map((container) => (
              <option key={container.id} value={container.id}>
                {containerLabel(container)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            disabled={isSubmitting}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Transfer quantity"
          />
        </div>

        {validationMessage ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {validationMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="transfer-confirm-button"
        >
          {isSubmitting ? 'Transferring...' : 'Transfer'}
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
