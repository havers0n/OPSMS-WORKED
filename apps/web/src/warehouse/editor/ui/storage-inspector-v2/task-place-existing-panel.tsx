import type { Container } from '@wos/domain';
import { useT } from '@/shared/i18n';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface PlaceExistingContainerTaskPanelProps {
  containers: Container[];
  excludedContainerIds: Set<string>;
  selectedContainerId: string;
  isLoading: boolean;
  isSubmitting: boolean;
  locationId: string | null;
  errorMessage: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onContainerChange: (containerId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

type Translator = ReturnType<typeof useT>;

function containerLabel(container: Container, t: Translator) {
  const code = container.externalCode ?? container.systemCode;
  return t('storage.place.containerLabel', { code });
}

export function PlaceExistingContainerTaskPanel({
  containers,
  excludedContainerIds,
  selectedContainerId,
  isLoading,
  isSubmitting,
  locationId,
  errorMessage,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onContainerChange,
  onConfirm,
  onCancel
}: PlaceExistingContainerTaskPanelProps) {
  const t = useT();
  const containersAlreadyHere = containers.filter((container) => excludedContainerIds.has(container.id));
  const availableContainers = containers.filter(
    (container) => container.status === 'active' && !excludedContainerIds.has(container.id)
  );
  const canSubmit = Boolean(locationId) && Boolean(selectedContainerId) && !isSubmitting;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label={t('storage.action.placeExistingContainer')}>
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label={t('storage.action.cancelPlaceExistingContainer')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="mt-1 text-sm font-semibold text-gray-900">{t('storage.action.placeExistingContainer')}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            {t('storage.field.container')} <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedContainerId}
            onChange={(event) => onContainerChange(event.target.value)}
            disabled={isSubmitting || isLoading || availableContainers.length === 0}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('storage.field.existingContainer')}
          >
            <option value="">{isLoading ? t('storage.placeholder.loadingContainers') : t('storage.placeholder.selectContainer')}</option>
            {availableContainers.map((container) => (
              <option key={container.id} value={container.id}>
                {containerLabel(container, t)}
              </option>
            ))}
          </select>
        </div>

        {!isLoading && availableContainers.length === 0 ? (
          <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {t('storage.place.noAvailableContainers')}
          </p>
        ) : null}

        {!isLoading && availableContainers.length > 0 ? (
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {t('storage.place.hiddenContainersInfo')}
          </p>
        ) : null}

        {!isLoading && containersAlreadyHere.length > 0 ? (
          <p className="text-xs text-gray-500">
            {t('storage.place.hiddenHereCount', { count: containersAlreadyHere.length })}
          </p>
        ) : null}

        {!locationId ? <p className="text-xs text-gray-400">{t('storage.state.resolvingLocation')}</p> : null}

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
          aria-label={t('storage.action.confirmPlaceExistingContainer')}
        >
          {isSubmitting ? t('storage.action.placing') : t('storage.action.placeContainer')}
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
