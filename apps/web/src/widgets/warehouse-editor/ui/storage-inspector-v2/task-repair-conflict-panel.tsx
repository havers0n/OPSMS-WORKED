import type { ProductLocationRoleValue } from '@wos/domain';
import type { ActiveContainerProduct } from './helpers';
import { TaskPanelBreadcrumb } from './shared';

export interface RepairConflictTaskPanelProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  product: ActiveContainerProduct;
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  conflictingRoles: ProductLocationRoleValue[];
  conflictingRowCount: number;
  conflictingRowIds: string[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onResolve: (role: ProductLocationRoleValue) => Promise<void>;
  onClear: () => Promise<void>;
}

export function RepairConflictTaskPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  product,
  structuralDefaultText,
  effectiveRoleText,
  sourceText,
  conflictingRoles,
  conflictingRowCount,
  conflictingRowIds,
  isSubmitting,
  errorMessage,
  onCancel,
  onResolve,
  onClear
}: RepairConflictTaskPanelProps) {
  const rolesSummary = conflictingRoles.length > 0
    ? conflictingRoles
        .map((role) => (role === 'primary_pick' ? 'Primary Pick' : 'Reserve'))
        .join(', ')
    : 'Unknown';

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Repair location conflict"
      data-testid="task-repair-conflict-panel"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel conflict repair"
        >
          ← Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">Repair explicit override conflict</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1">
          <p className="font-medium text-gray-700">Product + location context</p>
          <p className="font-mono text-gray-900">{product.sku ?? product.name}</p>
          <p className="text-gray-600">{product.name}</p>
          <p className="text-gray-600">
            Structural default: <span className="font-medium">{structuralDefaultText}</span>
          </p>
          <p className="text-gray-600">
            Effective role: <span className="font-medium">{effectiveRoleText}</span>
          </p>
          <p className="text-gray-600">
            Source: <span className="font-medium">{sourceText}</span>
          </p>
        </div>

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1" data-testid="repair-conflict-details">
          <p className="font-medium text-amber-800">Conflict details</p>
          <p className="text-amber-900" data-testid="repair-conflict-roles">
            Roles present: <span className="font-medium">{rolesSummary}</span>
          </p>
          <p className="text-amber-900" data-testid="repair-conflict-row-count">
            Published explicit rows: <span className="font-medium">{conflictingRowCount}</span>
          </p>
          {conflictingRowIds.length > 0 && (
            <p className="text-amber-900" data-testid="repair-conflict-row-ids">
              Row IDs: <span className="font-mono">{conflictingRowIds.join(', ')}</span>
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex flex-col gap-2 flex-shrink-0">
        <button
          onClick={() => void onResolve('primary_pick')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="repair-conflict-primary-pick-action"
        >
          {isSubmitting ? 'Repairing…' : 'Resolve as Primary Pick'}
        </button>
        <button
          onClick={() => void onResolve('reserve')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="repair-conflict-reserve-action"
        >
          Resolve as Reserve
        </button>
        <button
          onClick={() => void onClear()}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
          data-testid="repair-conflict-clear-action"
        >
          Clear explicit overrides
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
