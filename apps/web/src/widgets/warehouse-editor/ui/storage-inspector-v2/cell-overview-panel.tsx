import type { LocationStorageSnapshotRow } from '@wos/domain';
import { CellStatusChip } from '@/entities/cell/ui/cell-status-chip';
import { LocationAddress } from '@/entities/location/ui/location-address';
import {
  InspectorFooter,
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
  onOpenCreateWithProductTask
}: CellOverviewPanelProps) {
  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={`Location inspector: ${locationCode}`}
    >
      <div className={inspectorSectionClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-900">{locationCode}</div>
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
          <div className={inspectorSectionTitleClassName}>Current Contents</div>
          {!isOccupied ? (
            <div className="mt-2 text-xs text-gray-400">Empty</div>
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
                    aria-label={`View container ${displayCode}`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-semibold text-gray-900">{displayCode}</div>
                      <div className="mt-0.5 text-[11px] text-gray-500 capitalize">{first.containerStatus}</div>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">
                      Open
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>Inventory Preview</div>
          {inventoryPreviewRows.length === 0 ? (
            <div className="mt-2 text-xs text-gray-400">0 items</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {inventoryPreviewRows.map((row, idx) => {
                const item = inventoryLabel(row, idx);
                return (
                  <div key={item.key} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1 text-gray-600">
                      {row.product?.sku ? (
                        <span className="font-mono text-[11px] text-gray-500">{row.product.sku}</span>
                      ) : null}
                      <span className="ml-1.5 truncate">{item.label}</span>
                    </div>
                    <span className="font-mono text-[11px] text-gray-700">
                      {item.qty} {item.uom}
                    </span>
                  </div>
                );
              })}
              {inventoryOverflow > 0 ? (
                <div className="text-[11px] text-gray-400">
                  +{inventoryOverflow} more item{inventoryOverflow > 1 ? 's' : ''}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200 px-4 py-2.5" data-testid="cell-override-hint">
          <div className={inspectorSectionTitleClassName}>Role Context</div>
          <div className="mt-1.5 text-[11px] leading-5 text-gray-500">
            Location role context is shown for container detail. Select a container with one active SKU to resolve the effective role.
          </div>
        </div>

        <div className="mt-auto px-4 py-3">
          <div className="grid gap-2">
            <button
              onClick={onOpenCreateTask}
              className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              aria-label="Create container at this location"
            >
              Create container
            </button>
            <button
              onClick={onOpenCreateWithProductTask}
              className="h-8 rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              aria-label="Create container with product at this location"
            >
              Create container with product
            </button>
          </div>
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
