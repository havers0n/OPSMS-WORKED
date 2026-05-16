import type { ContainerType } from '@wos/domain';
import { useT } from '@/shared/i18n';
import {
  ContainerTypeSelect,
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface CreateContainerTaskPanelProps {
  containerTypes: ContainerType[];
  containerTypeId: string;
  externalCode: string;
  isSubmitting: boolean;
  locationId: string | null;
  errorMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onContainerTypeChange: (id: string) => void;
  onExternalCodeChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateContainerTaskPanel({
  containerTypes,
  containerTypeId,
  externalCode,
  isSubmitting,
  locationId,
  errorMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onContainerTypeChange,
  onExternalCodeChange,
  onConfirm,
  onCancel
}: CreateContainerTaskPanelProps) {
  const t = useT();
  const canSubmit = Boolean(containerTypeId) && Boolean(locationId) && !isSubmitting;

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.action.createContainer')}
    >
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label={t('storage.action.cancelCreateContainer')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">{t('storage.action.createContainer')}</p>
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
          aria-label={t('storage.action.confirmCreateContainer')}
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
