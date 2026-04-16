import type { ContainerType } from '@wos/domain';
import { ContainerTypeSelect, TaskPanelBreadcrumb } from './shared';

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
  const canSubmit = Boolean(containerTypeId) && Boolean(locationId) && !isSubmitting;

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Create container"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel create container"
        >
          ← Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">Create container</p>
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
            External code <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={externalCode}
            onChange={(event) => onExternalCodeChange(event.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. PLT-0042"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="External code"
          />
        </div>

        {!locationId && <p className="text-xs text-gray-400">Resolving location…</p>}

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Confirm create container"
        >
          {isSubmitting ? 'Creating…' : 'Create container'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
