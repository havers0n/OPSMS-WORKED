import type { MoveTaskState } from './mode';
import { useT } from '@/shared/i18n';
import {
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface MoveContainerTaskPanelProps {
  moveTaskState: MoveTaskState;
  rackDisplayCode: string;
  targetLocationLoading: boolean;
  resolvedTargetLocationCode: string | null;
  canConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MoveContainerTaskPanel({
  moveTaskState,
  rackDisplayCode,
  targetLocationLoading,
  resolvedTargetLocationCode,
  canConfirm,
  onConfirm,
  onCancel
}: MoveContainerTaskPanelProps) {
  const t = useT();
  const isTargetSameAsSource = moveTaskState.targetCellId === moveTaskState.sourceCellId;
  const isMoving = moveTaskState.stage === 'moving';

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.action.moveContainer')}
    >
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isMoving}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label={t('storage.action.cancelMoveContainer')}
        >
          {t('storage.action.cancel')}
        </button>
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span dir="ltr">{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium" dir="ltr">{moveTaskState.sourceLocationCode}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 mt-1">{t('storage.action.moveContainer')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('storage.field.container')}</p>
          <p className="font-mono text-sm font-semibold text-gray-900" dir="ltr">
            {moveTaskState.sourceContainerDisplayCode}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('storage.field.from')}</p>
          <p className="font-mono text-sm text-gray-700" dir="ltr">{moveTaskState.sourceLocationCode}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('storage.field.to')}</p>
          {moveTaskState.targetCellId === null ? (
            <p className="text-sm text-gray-400 italic" data-testid="move-target-placeholder">
              {t('storage.move.targetPlaceholder')}
            </p>
          ) : isTargetSameAsSource ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {t('storage.move.sameAsSource')}
            </p>
          ) : targetLocationLoading ? (
            <p className="text-sm text-gray-400">{t('storage.state.resolvingLocation')}</p>
          ) : (
            <p className="font-mono text-sm text-gray-700" data-testid="move-target-selected" dir="ltr">
              {resolvedTargetLocationCode ?? '-'}
            </p>
          )}
        </div>

        {moveTaskState.stage === 'moving' && <p className="text-sm text-gray-500">{t('storage.action.moving')}</p>}

        {moveTaskState.stage === 'error' && moveTaskState.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {moveTaskState.errorMessage}
          </p>
        )}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        {moveTaskState.stage === 'error' ? (
          <>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('storage.action.retry')}
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              {t('storage.action.cancel')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('storage.action.confirmMoveContainer')}
              data-testid="move-confirm-button"
            >
              {isMoving ? t('storage.action.moving') : t('storage.action.confirmMoveContainer')}
            </button>
            <button
              onClick={onCancel}
              disabled={isMoving}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {t('storage.action.cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
