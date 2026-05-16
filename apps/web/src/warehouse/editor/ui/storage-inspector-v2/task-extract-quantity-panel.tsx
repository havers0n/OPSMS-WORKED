import type { Container, ContainerType } from '@wos/domain';
import { translate, useT } from '@/shared/i18n';
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
  return sourceLine.product?.name ?? sourceLine.product?.sku ?? sourceLine.itemRef ?? translate('storage.state.inventoryLine');
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
  const t = useT();
  const availableContainers = containers.filter(
    (container) => container.status === 'active' && container.id !== sourceLine.containerId
  );
  const canSubmit = !isSubmitting && !validationMessage;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label={t('storage.extract.panelLabel')}>
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label={t('storage.action.cancelExtractQuantity')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">{t('storage.action.extractQuantity')}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <div className="font-medium text-gray-900">{sourceLineLabel(sourceLine)}</div>
          <div className="mt-1 font-mono text-[11px] text-gray-500">
            {t('storage.transfer.sourceSummary', {
              containerCode: sourceContainerDisplayCode,
              quantity: sourceLine.quantity ?? t('storage.transfer.unknownQuantity'),
              uom: sourceLine.uom ?? ''
            })}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-gray-700">{t('storage.field.targetMode')}</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetMode === 'existing-container'}
              onChange={() => onTargetModeChange('existing-container')}
              disabled={isSubmitting}
            />
            {t('storage.field.existingContainerMode')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetMode === 'new-container'}
              onChange={() => onTargetModeChange('new-container')}
              disabled={isSubmitting}
            />
            {t('storage.field.newContainerMode')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="radio"
              checked={targetMode === 'loose'}
              onChange={() => onTargetModeChange('loose')}
              disabled={isSubmitting}
            />
            {t('storage.field.looseMode')} <span className="text-[11px]">({t('storage.field.notAvailableYet')})</span>
          </label>
        </fieldset>

        {targetMode === 'existing-container' ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              {t('storage.field.targetContainer')} <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTargetContainerId}
              onChange={(event) => onTargetContainerChange(event.target.value)}
              disabled={isSubmitting || isLoadingContainers || availableContainers.length === 0}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label={t('storage.field.targetContainer')}
            >
              <option value="">{isLoadingContainers ? t('storage.placeholder.loadingContainers') : t('storage.placeholder.selectContainer')}</option>
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
                {t('storage.field.externalCode')} <span className="text-gray-400">({t('storage.field.optional')})</span>
              </label>
              <input
                type="text"
                value={newContainerExternalCode}
                onChange={(event) => onNewContainerExternalCodeChange(event.target.value)}
                disabled={isSubmitting}
                placeholder={t('storage.placeholder.externalCodeExample')}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                aria-label={t('storage.field.externalCode')}
                dir="ltr"
              />
            </div>
          </div>
        ) : null}

        {targetMode === 'loose' ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {t('storage.extract.looseUnavailable')}
          </p>
        ) : null}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            {t('storage.field.quantity')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            disabled={isSubmitting}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.quantity')}
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
          {isSubmitting ? t('storage.action.extracting') : t('storage.action.extract')}
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
