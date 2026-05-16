import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';
import { useT } from '@/shared/i18n';

export interface RemoveContainerTaskPanelProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  containerDisplayCode: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveContainerTaskPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  containerDisplayCode,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel
}: RemoveContainerTaskPanelProps) {
  const t = useT();

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label={t('storage.action.removeFromLocation')}>
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label={t('storage.action.cancelRemoveContainer')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="mt-1 text-sm font-semibold text-gray-900">{t('storage.action.removeFromLocation')}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('storage.field.container')}</p>
          <p className="font-mono text-sm font-semibold text-gray-900" dir="ltr">{containerDisplayCode}</p>
        </div>
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('storage.remove.warning')}
        </p>

        {errorMessage ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('storage.action.confirmRemoveContainer')}
        >
          {isSubmitting ? t('storage.action.removing') : t('storage.action.remove')}
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
