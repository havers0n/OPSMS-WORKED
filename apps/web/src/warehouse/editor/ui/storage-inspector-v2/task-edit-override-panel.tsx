import { useEffect, useState } from 'react';
import type { ActiveContainerProduct } from './helpers';
import type { ProductLocationRoleValue } from '@wos/domain';
import { useT } from '@/shared/i18n';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

export interface EditOverrideTaskPanelProps {
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

export function EditOverrideTaskPanel({
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
}: EditOverrideTaskPanelProps) {
  const t = useT();
  const [selectedRole, setSelectedRole] = useState<ProductLocationRoleValue>(defaultRole);

  useEffect(() => {
    setSelectedRole(defaultRole);
  }, [defaultRole]);

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.action.editOverride')}
      data-testid="task-edit-override-panel"
    >
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label={t('storage.action.cancelEditOverride')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb rackDisplayCode={rackDisplayCode} activeLevel={activeLevel} locationCode={locationCode} />
        <p className="text-sm font-semibold text-gray-900 mt-1">{t('storage.action.editOverride')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1">
          <p className="font-medium text-gray-700">{t('storage.field.productLocationContext')}</p>
          <p className="font-mono text-gray-900" dir="ltr">{product.sku ?? product.name}</p>
          <p className="text-gray-600">{product.name}</p>
          <p className="text-gray-600">
            {t('storage.field.structuralDefault')}: <span className="font-medium">{structuralDefaultText}</span>
          </p>
          <p className="text-gray-600">
            {t('storage.field.effectiveRole')}: <span className="font-medium">{effectiveRoleText}</span>
          </p>
          <p className="text-gray-600">
            {t('storage.field.source')}: <span className="font-medium">{sourceText}</span>
          </p>
        </div>

        <fieldset className="space-y-2" data-testid="override-role-selector">
          <legend className="text-xs font-medium text-gray-700">{t('storage.field.explicitOverride')}</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="override-role"
              checked={selectedRole === 'primary_pick'}
              onChange={() => setSelectedRole('primary_pick')}
              disabled={isSubmitting}
            />
            {t('storage.role.primaryPickSentence')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="override-role"
              checked={selectedRole === 'reserve'}
              onChange={() => setSelectedRole('reserve')}
              disabled={isSubmitting}
            />
            {t('storage.role.reserve')}
          </label>
        </fieldset>

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex gap-2`}>
        <button
          onClick={() => void onSave(selectedRole)}
          disabled={isSubmitting}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('storage.action.saveOverride')}
        >
          {isSubmitting ? t('storage.action.saving') : t('storage.action.saveOverride')}
        </button>
        {hasExplicitOverride && (
          <button
            onClick={() => void onClear()}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            data-testid="clear-override-action"
          >
            {t('storage.action.clearOverride')}
          </button>
        )}
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
