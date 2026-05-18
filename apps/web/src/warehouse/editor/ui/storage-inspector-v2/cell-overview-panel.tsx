import type { LocationStorageSnapshotRow } from '@wos/domain';
import { CellStatusChip } from '@/entities/cell/ui/cell-status-chip';
import { LocationAddress } from '@/entities/location/ui/location-address';
import { useT } from '@/shared/i18n';
import {
  InspectorFooter,
  inspectorActionButtonClassName,
  inspectorRowCardClassName,
  inspectorScrollBodyClassName,
  inspectorSectionClassName,
  inspectorSectionTitleClassName,
  inspectorShellClassName
} from './shared';

type GroupedContainer = {
  containerId: string;
  rows: LocationStorageSnapshotRow[];
};

type CellOverviewPanelProps = {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  isOccupied: boolean;
  locationType: string | null;
  containers: GroupedContainer[];
  inventoryPreviewRows: LocationStorageSnapshotRow[];
  inventoryOverflow: number;
  onSelectContainer: (containerId: string) => void;
  onOpenCreateTask: () => void;
  onOpenCreateFromPresetTask: () => void;
  onOpenCreateWithProductTask: () => void;
};

function inventoryLabel(row: LocationStorageSnapshotRow, idx: number) {
  return {
    key: `${row.containerId}-${row.itemRef ?? idx}`,
    label: row.product?.name ?? row.product?.sku ?? row.itemRef ?? '-',
    qty: row.quantity ?? 0,
    uom: row.uom ?? ''
  };
}

export function CellOverviewPanel({
  rackDisplayCode,
  activeLevel,
  locationCode,
  isOccupied,
  locationType,
  containers,
  inventoryPreviewRows,
  inventoryOverflow,
  onSelectContainer,
  onOpenCreateTask,
  onOpenCreateFromPresetTask,
  onOpenCreateWithProductTask
}: CellOverviewPanelProps) {
  const t = useT();

  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={t('storage.inspector.locationLabel', { locationCode })}
    >
      <div className={inspectorSectionClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-900" dir="ltr">{locationCode}</div>
            <div className="mt-1">
              <LocationAddress
                rackDisplayCode={rackDisplayCode}
                activeLevel={activeLevel}
                locationCode={locationCode}
              />
            </div>
          </div>
          {locationType ? (
            <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
              {locationType.replace('_', ' ')}
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <CellStatusChip occupied={isOccupied} />
        </div>
      </div>

      <div className={inspectorScrollBodyClassName}>
        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>{t('storage.field.currentContents')}</div>
          {!isOccupied ? (
            <div className="mt-2 text-xs text-gray-400">{t('storage.status.empty')}</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {containers.map(({ containerId, rows }) => {
                const first = rows[0];
                const displayCode = first.externalCode ?? first.systemCode;

                return (
                  <button
                    key={containerId}
                    onClick={() => onSelectContainer(containerId)}
                    className={`${inspectorRowCardClassName} w-full transition-colors hover:bg-blue-50`}
                    aria-label={t('storage.inspector.viewContainer', { containerCode: displayCode })}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-semibold text-gray-900" dir="ltr">{displayCode}</div>
                      <div className="mt-0.5 text-[11px] text-gray-500 capitalize">{first.containerStatus}</div>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">
                      {t('storage.action.open')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>{t('storage.field.inventoryPreview')}</div>
          {inventoryPreviewRows.length === 0 ? (
            <div className="mt-2 text-xs text-gray-400">{t('storage.state.zeroItems')}</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {inventoryPreviewRows.map((row, idx) => {
                const item = inventoryLabel(row, idx);
                return (
                  <div key={item.key} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1 text-gray-600">
                      {row.product?.sku ? (
                        <span className="font-mono text-[11px] text-gray-500" dir="ltr">{row.product.sku}</span>
                      ) : null}
                      <span className="ms-1.5 truncate">{item.label}</span>
                    </div>
                    <span className="font-mono text-[11px] text-gray-700">
                      {item.qty} {item.uom}
                    </span>
                  </div>
                );
              })}
              {inventoryOverflow > 0 ? (
                <div className="text-[11px] text-gray-400">
                  {t('storage.state.moreItems', { count: inventoryOverflow })}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200 px-4 py-2.5" data-testid="cell-override-hint">
          <div className={inspectorSectionTitleClassName}>{t('storage.field.roleContext')}</div>
          <div className="mt-1.5 text-[11px] leading-5 text-gray-500">
            {t('storage.inspector.roleContextHint')}
          </div>
        </div>

        <div className="mt-auto px-4 py-3">
          <div className="grid gap-2">
            <button
              onClick={onOpenCreateTask}
              className={inspectorActionButtonClassName}
              aria-label={t('storage.action.createContainerAtLocation')}
            >
              {t('storage.action.createContainer')}
            </button>
            <button
              onClick={onOpenCreateWithProductTask}
              className={inspectorActionButtonClassName}
              aria-label={t('storage.action.createContainerWithProductAtLocation')}
            >
              {t('storage.action.createContainerWithProduct')}
            </button>
            <button
              onClick={onOpenCreateFromPresetTask}
              className={inspectorActionButtonClassName}
              aria-label={t('storage.action.createFromPresetAtLocation')}
              data-testid="create-from-preset-action"
            >
              {t('storage.action.createFromPreset')}
            </button>
          </div>
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
