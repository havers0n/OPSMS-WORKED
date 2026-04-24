import type { Container, ContainerType } from '@wos/domain';
import {
  ContainerTypeSelect,
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';
import type { TransferSourceLine } from './task-transfer-to-container-panel';

export type ExtractTargetMode = 'existing-container' | 'new-container' | 'loose';

export interface ExtractQuantityTaskPanelProps {
  sourceLine: TransferSourceLine;
  containers: Container[];
  containerTypes: ContainerType[];
  sourceContainerDisplayCode: string;
  targetMode: ExtractTargetMode;
  selectedTargetContainerId: string;
  newContainerTypeId: string;
  newContainerExternalCode: string;
  quantity: string;
  isSubmitting: boolean;
  isLoadingContainers: boolean;
  errorMessage: string | null;
  validationMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onTargetModeChange: (mode: ExtractTargetMode) => void;
  onTargetContainerChange: (containerId: string) => void;
  onNewContainerTypeChange: (containerTypeId: string) => void;
  onNewContainerExternalCodeChange: (externalCode: string) => void;
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

export function ExtractQuantityTaskPanel({
  sourceLine,
  containers,
  containerTypes,
  sourceContainerDisplayCode,
  targetMode,
  selectedTargetContainerId,
  newContainerTypeId,
  newContainerExternalCode,
  quantity,
  isSubmitting,
  isLoadingContainers,
  errorMessage,
  validationMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onTargetModeChange,
  onTargetContainerChange,
  onNewContainerTypeChange,
  onNewContainerExternalCodeChange,
  onQuantityChange,
  onConfirm,
  onCancel
}: ExtractQuantityTaskPanelProps) {
  const availableContainers = containers.filter(
    (container) => container.status === 'active' && container.id !== sourceLine.containerId
  );
  const canSubmit = !isSubmitting && !validationMessage;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label="Extract inventory quantity">
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Cancel extract quantity"
        >
          Cancel
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">Extract quantity</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-medium text-gray-900">{sourceLineLabel(sourceLine)}</div>
          <div className="mt-1 font-mono text-[11px] text-gray-500">
            From {sourceContainerDisplayCode} / {sourceLine.quantity ?? 'unknown'} {sourceLine.uom ?? ''}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-gray-700">Target mode</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetMode === 'existing-container'}
              onChange={() => onTargetModeChange('existing-container')}
              disabled={isSubmitting}
            />
            Existing container
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetMode === 'new-container'}
              onChange={() => onTargetModeChange('new-container')}
              disabled={isSubmitting}
            />
            New container
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="radio"
              checked={targetMode === 'loose'}
              onChange={() => onTargetModeChange('loose')}
              disabled={isSubmitting}
            />
            Loose <span className="text-[11px]">(not available yet)</span>
          </label>
        </fieldset>

        {targetMode === 'existing-container' ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Target container <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTargetContainerId}
              onChange={(event) => onTargetContainerChange(event.target.value)}
              disabled={isSubmitting || isLoadingContainers || availableContainers.length === 0}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label="Extract target container"
            >
              <option value="">{isLoadingContainers ? 'Loading containers...' : 'Select container...'}</option>
              {availableContainers.map((container) => (
                <option key={container.id} value={container.id}>
                  {containerLabel(container)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {targetMode === 'new-container' ? (
          <div className="space-y-3">
            <ContainerTypeSelect
              containerTypes={containerTypes}
              value={newContainerTypeId}
              onChange={onNewContainerTypeChange}
              disabled={isSubmitting}
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                External code <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={newContainerExternalCode}
                onChange={(event) => onNewContainerExternalCodeChange(event.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. PLT-0042"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                aria-label="New extract container external code"
              />
            </div>
          </div>
        ) : null}

        {targetMode === 'loose' ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Loose extract is not available yet. Current BFF routes require a target container.
          </p>
        ) : null}

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
            aria-label="Extract quantity"
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
          data-testid="extract-confirm-button"
        >
          {isSubmitting ? 'Extracting...' : 'Extract'}
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
