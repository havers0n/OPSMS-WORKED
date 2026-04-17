import type { LocationStorageSnapshotRow } from '@wos/domain';
import { CellStatusChip } from '@/entities/cell/ui/cell-status-chip';
import { LocationAddress } from '@/entities/location/ui/location-address';
import { InspectorFooter, SectionHeader } from './shared';

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
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Location inspector: ${locationCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <LocationAddress
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader title="Status" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <CellStatusChip occupied={isOccupied} />
          {locationType && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-400">Type:</span> {locationType.replace('_', ' ')}
            </div>
          )}
        </div>

        <SectionHeader title="Current Contents" />
        <div className="px-4 py-3 border-b border-gray-200">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">None</p>
          ) : (
            <div className="space-y-2">
              {containers.map(({ containerId, rows }) => {
                const first = rows[0];
                const displayCode = first.externalCode ?? first.systemCode;
                return (
                  <button
                    key={containerId}
                    onClick={() => onSelectContainer(containerId)}
                    className="w-full text-left bg-gray-50 border border-gray-200 rounded px-3 py-2 space-y-1 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    aria-label={`View container ${displayCode}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Container</div>
                    <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
                    <div className="text-xs text-gray-500 capitalize">Status: {first.containerStatus}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SectionHeader title="Inventory" />
        <div className="px-4 py-3">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">0 items</p>
          ) : inventoryPreviewRows.length === 0 ? (
            <p className="text-sm text-gray-400 italic">0 items</p>
          ) : (
            <div className="space-y-1.5">
              {inventoryPreviewRows.map((row, idx) => {
                const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                const qty = row.quantity ?? 0;
                const uom = row.uom ?? '';
                return (
                  <div key={`${row.containerId}-${row.itemRef ?? idx}`} className="flex items-baseline justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      {row.product?.sku && <span className="font-mono text-gray-500">{row.product.sku}</span>}
                      <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                    </div>
                    <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">{qty} {uom}</span>
                  </div>
                );
              })}
              {inventoryOverflow > 0 && (
                <p className="text-xs text-gray-400 pt-0.5">
                  +{inventoryOverflow} more item{inventoryOverflow > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        <SectionHeader title="Override" />
        <div className="px-4 py-3 border-b border-gray-200" data-testid="cell-override-hint">
          <p className="text-xs text-gray-600">Location role context is shown for container detail.</p>
          <p className="text-xs text-gray-500 mt-1">Select a container with one active SKU to resolve effective role.</p>
        </div>

        <SectionHeader title="Actions" />
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={onOpenCreateTask}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container at this location"
          >
            Create container
          </button>
          <button
            onClick={onOpenCreateWithProductTask}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container with product at this location"
          >
            Create container with product
          </button>
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
