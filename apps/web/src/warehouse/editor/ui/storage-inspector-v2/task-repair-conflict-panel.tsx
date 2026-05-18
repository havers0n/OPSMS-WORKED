import type { ProductLocationRoleValue } from '@wos/domain';
import type { ActiveContainerProduct } from './helpers';
import { useT } from '@/shared/i18n';
import {
  TaskPanelBreadcrumb,
  inspectorFooterActionsClassName,
  inspectorHeaderClassName,
  inspectorShellClassName
} from './shared';

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
  const t = useT();
  const rolesSummary = conflictingRoles.length > 0
    ? conflictingRoles
        .map((role) => (role === 'primary_pick' ? t('storage.role.primaryPick') : t('storage.role.reserve')))
        .join(', ')
    : t('storage.state.unknown');

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.action.repairExplicitOverrideConflict')}
      data-testid="task-repair-conflict-panel"
    >
      <div className={inspectorHeaderClassName}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label={t('storage.action.cancelConflictRepair')}
        >
          {t('storage.action.cancel')}
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">{t('storage.action.repairExplicitOverrideConflict')}</p>
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

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1" data-testid="repair-conflict-details">
          <p className="font-medium text-amber-800">{t('storage.roleSource.conflict')}</p>
          <p className="text-amber-900" data-testid="repair-conflict-roles">
            {t('storage.field.rolesPresent')}: <span className="font-medium">{rolesSummary}</span>
          </p>
          <p className="text-amber-900" data-testid="repair-conflict-row-count">
            {t('storage.field.publishedExplicitRows')}: <span className="font-medium">{conflictingRowCount}</span>
          </p>
          {conflictingRowIds.length > 0 && (
            <p className="text-amber-900" data-testid="repair-conflict-row-ids">
              {t('storage.field.rowIds')}: <span className="font-mono" dir="ltr">{conflictingRowIds.join(', ')}</span>
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errorMessage}
          </p>
        )}
      </div>

      <div className={`${inspectorFooterActionsClassName} flex flex-col gap-2`}>
        <button
          onClick={() => void onResolve('primary_pick')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="repair-conflict-primary-pick-action"
        >
          {isSubmitting ? t('storage.action.repairing') : t('storage.action.resolveAsPrimaryPick')}
        </button>
        <button
          onClick={() => void onResolve('reserve')}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="repair-conflict-reserve-action"
        >
          {t('storage.action.resolveAsReserve')}
        </button>
        <button
          onClick={() => void onClear()}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
          data-testid="repair-conflict-clear-action"
        >
          {t('storage.action.clearExplicitOverrides')}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {t('storage.action.cancel')}
        </button>
      </div>
    </div>
  );
}
