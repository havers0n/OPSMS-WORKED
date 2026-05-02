import type { Container } from '@wos/domain';
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

function containerLabel(container: Container) {
  const code = container.externalCode ?? container.systemCode;
  return `${code} - active storage - not in this location`;
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
  const containersAlreadyHere = containers.filter((container) => excludedContainerIds.has(container.id));
  const availableContainers = containers.filter(
    (container) => container.status === 'active' && !excludedContainerIds.has(container.id)
  );
  const canSubmit = Boolean(locationId) && Boolean(selectedContainerId) && !isSubmitting;

  return (
    <div className={inspectorShellClassName} role="complementary" aria-label="Place existing container">
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Cancel place existing container"
        >
          Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="mt-1 text-sm font-semibold text-gray-900">Place existing container</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Container <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedContainerId}
            onChange={(event) => onContainerChange(event.target.value)}
            disabled={isSubmitting || isLoading || availableContainers.length === 0}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Existing container"
          >
            <option value="">{isLoading ? 'Loading containers...' : 'Select container...'}</option>
            {availableContainers.map((container) => (
              <option key={container.id} value={container.id}>
                {containerLabel(container)}
              </option>
            ))}
          </select>
        </div>

        {!isLoading && availableContainers.length === 0 ? (
          <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            No active storage containers outside this location are available.
          </p>
        ) : null}

        {!isLoading && availableContainers.length > 0 ? (
          <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Containers already in this location are hidden. Exact current placement is validated on submit.
          </p>
        ) : null}

        {!isLoading && containersAlreadyHere.length > 0 ? (
          <p className="text-xs text-gray-500">
            {containersAlreadyHere.length} container{containersAlreadyHere.length === 1 ? '' : 's'} already here hidden.
          </p>
        ) : null}

        {!locationId ? <p className="text-xs text-gray-400">Resolving location...</p> : null}

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
          aria-label="Confirm place existing container"
        >
          {isSubmitting ? 'Placing...' : 'Place container'}
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
