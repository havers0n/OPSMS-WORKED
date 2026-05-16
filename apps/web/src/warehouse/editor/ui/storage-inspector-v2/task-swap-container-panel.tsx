import type { SwapTaskState } from './mode';
import { translate, useT } from '@/shared/i18n';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface SwapContainerTaskPanelProps {
  swapTaskState: SwapTaskState;
  rackDisplayCode: string;
  targetLocationCode: string | null;
  targetContainerDisplayCode: string | null;
  targetContainerCount: number;
  targetLocationLoading: boolean;
  targetLocationId: string | null;
  canConfirm: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SwapContainerTaskPanel({
  swapTaskState,
  rackDisplayCode,
  targetLocationCode,
  targetContainerDisplayCode,
  targetContainerCount,
  targetLocationLoading,
  targetLocationId,
  canConfirm,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel
}: SwapContainerTaskPanelProps) {
  const t = useT();
  const targetStatus =
    swapTaskState.targetCellId === null
      ? t('storage.swap.selectOccupiedTarget')
      : targetLocationLoading
        ? t('storage.swap.loadingTarget')
        : targetLocationId === null
          ? t('storage.swap.targetUnavailable')
          : targetContainerCount === 0
            ? t('storage.swap.targetEmpty')
            : targetContainerCount > 1
              ? t('storage.swap.targetMultiple')
              : targetContainerDisplayCode
                ? translate('storage.swap.targetWithCode', { containerCode: targetContainerDisplayCode })
                : t('storage.swap.targetSelected');

  return (
    <div className={inspectorShellClassName}>
      <div className={inspectorHeaderClassName}>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={swapTaskState.sourceLevel ?? 1}
          locationCode={swapTaskState.sourceLocationCode}
        />
        <h2 className="mt-2 text-sm font-semibold text-gray-900">{t('storage.action.swapContainer')}</h2>
        <p className="mt-1 text-xs text-gray-500">
          {t('storage.swap.description')}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="font-semibold text-gray-700">{t('storage.field.sourceContainer')}</div>
          <div className="mt-1 font-mono text-gray-900" dir="ltr">{swapTaskState.sourceContainerDisplayCode}</div>
          <div className="mt-1 text-gray-500" dir="ltr">{swapTaskState.sourceLocationCode}</div>
        </div>

        <div className="rounded-sm border border-gray-200 bg-white px-3 py-2 text-xs">
          <div className="font-semibold text-gray-700">{t('storage.field.targetContainer')}</div>
          <div className="mt-1 text-gray-600">{targetStatus}</div>
          {targetLocationCode ? <div className="mt-1 text-gray-500" dir="ltr">{targetLocationCode}</div> : null}
        </div>

        {errorMessage ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className={inspectorFooterActionsClassName}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('storage.action.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isSubmitting}
          className="rounded-sm bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="swap-confirm-button"
        >
          {isSubmitting ? t('storage.action.swapping') : t('storage.action.confirmSwap')}
        </button>
      </div>
    </div>
  );
}
