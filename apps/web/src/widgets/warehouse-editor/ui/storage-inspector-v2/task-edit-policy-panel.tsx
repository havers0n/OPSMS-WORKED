import { useEffect, useState } from 'react';
import type {
  ActiveContainerProduct,
  ContainerPolicySummaryState,
  PolicyRoleChoice
} from './helpers';
import { policySummaryText } from './helpers';

export interface EditPolicyTaskPanelProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  product: ActiveContainerProduct;
  summaryState: ContainerPolicySummaryState;
  isSaving: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSave: (choice: PolicyRoleChoice) => Promise<void>;
}

export function EditPolicyTaskPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  product,
  summaryState,
  isSaving,
  errorMessage,
  onCancel,
  onSave
}: EditPolicyTaskPanelProps) {
  const initialChoice: PolicyRoleChoice = summaryState.kind === 'single-role' ? summaryState.role : 'none';
  const [selectedRole, setSelectedRole] = useState<PolicyRoleChoice>(initialChoice);

  useEffect(() => {
    setSelectedRole(initialChoice);
  }, [initialChoice]);

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Edit policy for location"
      data-testid="task-edit-policy-panel"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel edit policy"
        >
          ← Cancel
        </button>
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 mt-1">Edit picking policy for this location</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1">
          <p className="font-medium text-gray-700">Policy for SKU at this location</p>
          <p className="font-mono text-gray-900">{product.sku ?? product.name}</p>
          <p className="text-gray-600">{product.name}</p>
          <p className="text-gray-600">
            Current role: <span className="font-medium">{policySummaryText(summaryState)}</span>
          </p>
          {summaryState.kind === 'legacy-conflict' && (
            <p className="text-amber-700">Legacy conflict detected. Choose one role to normalize.</p>
          )}
        </div>

        <fieldset className="space-y-2" data-testid="policy-role-selector">
          <legend className="text-xs font-medium text-gray-700">Role for this SKU at this location</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="policy-role"
              checked={selectedRole === 'primary_pick'}
              onChange={() => setSelectedRole('primary_pick')}
              disabled={isSaving}
            />
            Primary pick
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="policy-role"
              checked={selectedRole === 'reserve'}
              onChange={() => setSelectedRole('reserve')}
              disabled={isSaving}
            />
            Reserve
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="policy-role"
              checked={selectedRole === 'none'}
              onChange={() => setSelectedRole('none')}
              disabled={isSaving}
            />
            None (remove policy)
          </label>
        </fieldset>

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <button
          onClick={() => void onSave(selectedRole)}
          disabled={isSaving}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Save policy for location"
        >
          {isSaving ? 'Saving…' : 'Save policy'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
