import {
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

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
  return (
    <div className={inspectorShellClassName} role="complementary" aria-label="Remove container from location">
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Cancel remove container"
        >
          Cancel
        </button>
        <div className="flex flex-wrap items-center gap-1 text-xs leading-relaxed text-gray-500">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono font-medium text-gray-900">{locationCode}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-gray-900">Remove from location</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Container</p>
          <p className="font-mono text-sm font-semibold text-gray-900">{containerDisplayCode}</p>
        </div>
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This clears the container current location and frees this location.
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
          aria-label="Confirm remove container"
        >
          {isSubmitting ? 'Removing...' : 'Remove'}
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
