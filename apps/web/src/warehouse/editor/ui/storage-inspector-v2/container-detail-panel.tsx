import type { LocationStorageSnapshotRow, StoragePreset } from '@wos/domain';
import { useI18n, useT } from '@/shared/i18n';
import { resolveUomPresentation } from '@/shared/uom';
import {
  InspectorFooter,
  inspectorRowCardClassName,
  inspectorScrollBodyClassName,
  inspectorSectionClassName,
  inspectorSectionTitleClassName,
  inspectorShellClassName
} from './shared';

type ContainerDetailPanelProps = {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  displayCode: string;
  firstRow: LocationStorageSnapshotRow | undefined;
  items: LocationStorageSnapshotRow[];
  selectedProduct: { sku?: string | null; name?: string | null } | null;
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  hasProductContext: boolean;
  isConflict: boolean;
  showNoneExplanation: boolean;
  materializationWarning: string | null;
  storagePresets: StoragePreset[];
  preferredPackagingProfileId: string | null;
  preferredPresetPending: boolean;
  canShowOverrideEntry: boolean;
  hasExplicitOverride: boolean;
  canShowRepairConflictEntry: boolean;
  isEmptyContainer: boolean;
  onBack: () => void;
  onOpenEditOverrideTask: () => void;
  onOpenRepairConflictTask: () => void;
  onOpenAddProductTask: () => void;
  onPreferredPresetChange: (presetId: string | null) => void;
  onOpenTransferToContainerTask: (row: LocationStorageSnapshotRow) => void;
  onOpenExtractQuantityTask: (row: LocationStorageSnapshotRow) => void;
  onStartMoveContainer: () => void;
  onOpenSwapContainerTask: () => void;
  onOpenRemoveContainerTask: () => void;
};

type Translator = ReturnType<typeof useT>;

function presetUsageLabel(status: LocationStorageSnapshotRow['presetUsageStatus'] | undefined, t: Translator) {
  switch (status) {
    case 'preferred_match':
      return t('storage.preset.preferredPreset');
    case 'standard_non_preferred':
      return t('storage.preset.standardPreset');
    case 'manual':
      return t('storage.preset.manual');
    default:
      return t('storage.preset.unknown');
  }
}

function presetMaterializationLabel(
  status: LocationStorageSnapshotRow['presetMaterializationStatus'] | undefined,
  t: Translator
) {
  switch (status) {
    case 'shell':
      return t('storage.preset.shell');
    case 'materialized':
      return t('storage.preset.materialized');
    case 'manual':
      return t('storage.preset.manualContents');
    default:
      return t('storage.preset.materializationUnknown');
  }
}

export function ContainerDetailPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  displayCode,
  firstRow,
  items,
  selectedProduct,
  structuralDefaultText,
  effectiveRoleText,
  sourceText,
  hasProductContext,
  isConflict,
  showNoneExplanation,
  materializationWarning,
  storagePresets,
  preferredPackagingProfileId,
  preferredPresetPending,
  canShowOverrideEntry,
  hasExplicitOverride,
  canShowRepairConflictEntry,
  isEmptyContainer,
  onBack,
  onOpenEditOverrideTask,
  onOpenRepairConflictTask,
  onOpenAddProductTask,
  onPreferredPresetChange,
  onOpenTransferToContainerTask,
  onOpenExtractQuantityTask,
  onStartMoveContainer,
  onOpenSwapContainerTask,
  onOpenRemoveContainerTask
}: ContainerDetailPanelProps) {
  const { locale } = useI18n();
  const t = useT();

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.inspector.containerDetailLabel', { containerCode: displayCode })}
    >
      <div className={inspectorSectionClassName}>
        <button
          onClick={onBack}
          className="mb-2 text-xs text-blue-600 hover:text-blue-800"
          aria-label={t('storage.action.backToCellOverview')}
        >
          {t('storage.action.back')}
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-900" dir="ltr">{displayCode}</div>
            <div className="mt-1 text-xs text-gray-500">
              <span dir="ltr">{rackDisplayCode}</span> / {t('storage.breadcrumb.level', { level: activeLevel })} / <span className="font-mono text-gray-900" dir="ltr">{locationCode}</span>
            </div>
          </div>
          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {t('storage.inspector.container')}
          </span>
        </div>
        {firstRow ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="capitalize">{t('storage.field.type')}: {firstRow.containerType}</span>
            <span className="capitalize">{t('storage.field.status')}: {firstRow.containerStatus}</span>
            <span>{presetUsageLabel(firstRow.presetUsageStatus, t)}</span>
            <span>{presetMaterializationLabel(firstRow.presetMaterializationStatus, t)}</span>
          </div>
        ) : null}
        {materializationWarning ? (
          <div
            className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
            data-testid="storage-preset-partial-failure-warning"
          >
            {materializationWarning}
          </div>
        ) : null}
      </div>

      <div className={inspectorScrollBodyClassName}>
        <div className={inspectorSectionClassName} data-testid="location-role-context">
          <div className={inspectorSectionTitleClassName}>{t('storage.field.locationRole')}</div>
          <div className="mt-2 space-y-1.5 text-xs text-gray-700">
            {selectedProduct ? (
              <p>
                {t('storage.field.sku')}: <span className="font-mono text-gray-900" dir="ltr">{selectedProduct.sku ?? selectedProduct.name}</span>
              </p>
            ) : null}
            <p>
              {t('storage.field.structuralDefault')}: <span className="font-medium text-gray-900">{structuralDefaultText}</span>
            </p>
            <p>
              {t('storage.field.effectiveRole')}: <span className="font-medium text-gray-900">{effectiveRoleText}</span>
            </p>
            <p>
              {t('storage.field.source')}: <span className="font-medium text-gray-900">{sourceText}</span>
            </p>
          </div>
          {!hasProductContext ? (
            <div className="mt-2 text-[11px] leading-5 text-gray-500" data-testid="location-role-product-context-required">
              {t('storage.inspector.productContextRequired')}
            </div>
          ) : null}
          {isConflict ? (
            <div className="mt-2 text-[11px] leading-5 text-amber-700" data-testid="location-role-conflict-note">
              {t('storage.inspector.multipleRolesConflict')}
            </div>
          ) : null}
          {showNoneExplanation ? (
            <div className="mt-2 text-[11px] leading-5 text-gray-500" data-testid="location-role-none-note">
              {t('storage.inspector.noRoleApplies')}
            </div>
          ) : null}
          {hasProductContext ? (
            <div className="mt-3 space-y-1">
              <label className="block text-[11px] font-medium text-gray-600">{t('storage.preset.preferredPreset')}</label>
              <select
                value={preferredPackagingProfileId ?? ''}
                onChange={(event) => onPreferredPresetChange(event.target.value || null)}
                disabled={preferredPresetPending}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 disabled:opacity-50"
                data-testid="preferred-storage-preset-select"
              >
                <option value="">{t('storage.preset.noPreferred')}</option>
                {storagePresets
                  .filter((preset) => preset.status === 'active' && preset.profileType === 'storage')
                  .map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.code} - {preset.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>{t('storage.field.actions')}</div>
          <div className="mt-2 grid gap-1.5">
            {canShowOverrideEntry ? (
              <div data-testid="override-task-entry">
                <button
                  onClick={onOpenEditOverrideTask}
                  className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                  data-testid="edit-override-action"
                >
                  {hasExplicitOverride ? t('storage.action.editOverride') : t('storage.action.setOverride')}
                </button>
              </div>
            ) : null}

            {canShowRepairConflictEntry ? (
              <div data-testid="repair-conflict-task-entry">
                <button
                  onClick={onOpenRepairConflictTask}
                  className="h-8 w-full rounded-sm border border-amber-300 bg-amber-50 px-3 text-left text-sm text-amber-800 hover:bg-amber-100"
                  data-testid="repair-conflict-action"
                >
                  {t('storage.action.repairConflict')}
                </button>
              </div>
            ) : null}

            {isEmptyContainer ? (
              <button
                onClick={onOpenAddProductTask}
                className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                data-testid="add-product-action"
              >
                {t('storage.action.addProduct')}
              </button>
            ) : null}

            <button
              onClick={onStartMoveContainer}
              className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              data-testid="move-container-action"
            >
              {t('storage.action.moveContainer')}
            </button>
            <button
              onClick={onOpenSwapContainerTask}
              className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              data-testid="swap-container-action"
            >
              {t('storage.action.swapContainer')}
            </button>
            <button
              onClick={onOpenRemoveContainerTask}
              className="h-8 w-full rounded-sm border border-red-200 bg-white px-3 text-left text-sm text-red-700 hover:border-red-300 hover:bg-red-50"
              data-testid="remove-container-action"
            >
              {t('storage.action.removeFromLocation')}
            </button>
          </div>
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>{t('storage.field.inventory')}</div>
          {items.length === 0 ? (
            <div className="mt-2 text-xs text-gray-400">{t('storage.state.emptyContainer')}</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {items.map((row, idx) => {
                const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '-';
                const qty = row.quantity ?? 0;
                const uom = resolveUomPresentation(row.uom, locale);
                return (
                  <div key={`${row.containerId}-${row.inventoryUnitId ?? row.itemRef ?? idx}`} className={inspectorRowCardClassName}>
                    <div className="min-w-0 flex-1 text-xs text-gray-600">
                      {row.product?.sku ? (
                        <span className="font-mono text-[11px] text-gray-500" dir="ltr">{row.product.sku}</span>
                      ) : null}
                      <span className="ms-1.5 truncate">{label}</span>
                      {row.inventoryUnitId ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            onClick={() => onOpenTransferToContainerTask(row)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                            data-testid="transfer-to-container-action"
                          >
                            {t('storage.action.transferToContainer')}
                          </button>
                          <button
                            onClick={() => onOpenExtractQuantityTask(row)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                            data-testid="extract-quantity-action"
                          >
                            {t('storage.action.extractQuantity')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <span className="font-mono text-[11px] text-gray-700">
                      {qty} {uom}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
