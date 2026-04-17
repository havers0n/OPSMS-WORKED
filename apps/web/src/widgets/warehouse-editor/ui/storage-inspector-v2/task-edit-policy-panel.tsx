import { useEffect, useState } from 'react';
import type { ActiveContainerProduct } from './helpers';
import type { ProductLocationRoleValue } from '@wos/domain';

export interface EditPolicyTaskPanelProps {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  product: ActiveContainerProduct;
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  hasExplicitOverride: boolean;
  defaultRole: ProductLocationRoleValue;
  isSubmitting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSave: (role: ProductLocationRoleValue) => Promise<void>;
  onClear: () => Promise<void>;
}

export function EditPolicyTaskPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  product,
  structuralDefaultText,
  effectiveRoleText,
  sourceText,
  hasExplicitOverride,
  defaultRole,
  isSubmitting,
  errorMessage,
  onCancel,
  onSave,
  onClear
}: EditPolicyTaskPanelProps) {
  const [selectedRole, setSelectedRole] = useState<ProductLocationRoleValue>(defaultRole);

  useEffect(() => {
    setSelectedRole(defaultRole);
  }, [defaultRole]);

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Edit override for location"
      data-testid="task-edit-policy-panel"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel edit override"
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
        <p className="text-sm font-semibold text-gray-900 mt-1">Edit explicit override</p>
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

        <fieldset className="space-y-2" data-testid="override-role-selector">
          <legend className="text-xs font-medium text-gray-700">Explicit override</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="override-role"
              checked={selectedRole === 'primary_pick'}
              onChange={() => setSelectedRole('primary_pick')}
              disabled={isSubmitting}
            />
            Primary pick
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="override-role"
              checked={selectedRole === 'reserve'}
              onChange={() => setSelectedRole('reserve')}
              disabled={isSubmitting}
            />
            Reserve
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
          disabled={isSubmitting}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Save override for location"
        >
          {isSubmitting ? 'Saving…' : 'Save override'}
        </button>
        {hasExplicitOverride && (
          <button
            onClick={() => void onClear()}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            data-testid="clear-override-action"
          >
            Clear override
          </button>
        )}
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
