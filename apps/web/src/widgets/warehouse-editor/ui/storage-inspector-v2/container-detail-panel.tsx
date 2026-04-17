import type { LocationStorageSnapshotRow, Product } from '@wos/domain';
import { LocationAddress } from '@/entities/location/ui/location-address';
import { InspectorFooter, SectionHeader } from './shared';

type ContainerDetailPanelProps = {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
  displayCode: string;
  firstRow: LocationStorageSnapshotRow | undefined;
  items: LocationStorageSnapshotRow[];
  selectedProduct: Product | null;
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  hasProductContext: boolean;
  isConflict: boolean;
  showNoneExplanation: boolean;
  canShowOverrideEntry: boolean;
  hasExplicitOverride: boolean;
  canShowRepairConflictEntry: boolean;
  isEmptyContainer: boolean;
  onBack: () => void;
  onOpenEditOverrideTask: () => void;
  onOpenRepairConflictTask: () => void;
  onOpenAddProductTask: () => void;
  onStartMoveContainer: () => void;
};

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
  canShowOverrideEntry,
  hasExplicitOverride,
  canShowRepairConflictEntry,
  isEmptyContainer,
  onBack,
  onOpenEditOverrideTask,
  onOpenRepairConflictTask,
  onOpenAddProductTask,
  onStartMoveContainer
}: ContainerDetailPanelProps) {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Container detail: ${displayCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2" aria-label="Back to cell overview">
          ← Back
        </button>
        <LocationAddress
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader title="Container" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-1">
          <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
          {firstRow && (
            <>
              <div className="text-xs text-gray-500 capitalize">Type: {firstRow.containerType}</div>
              <div className="text-xs text-gray-500 capitalize">Status: {firstRow.containerStatus}</div>
            </>
          )}
        </div>

        <SectionHeader title="Location Role" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="location-role-context">
          {selectedProduct && (
            <p className="text-xs text-gray-700">
              SKU: <span className="font-mono text-gray-900">{selectedProduct.sku ?? selectedProduct.name}</span>
            </p>
          )}
          <p className="text-xs text-gray-700">
            Structural default: <span className="font-medium text-gray-900">{structuralDefaultText}</span>
          </p>
          <p className="text-xs text-gray-700">
            Effective role: <span className="font-medium text-gray-900">{effectiveRoleText}</span>
          </p>
          <p className="text-xs text-gray-700">
            Source: <span className="font-medium text-gray-900">{sourceText}</span>
          </p>

          {!hasProductContext && (
            <p className="text-xs text-gray-500" data-testid="location-role-product-context-required">
              Product context required to resolve explicit override.
            </p>
          )}

          {isConflict && (
            <p className="text-xs text-amber-700" data-testid="location-role-conflict-note">
              Multiple published explicit roles exist for this product/location.
            </p>
          )}

          {showNoneExplanation && (
            <p className="text-xs text-gray-500" data-testid="location-role-none-note">
              No structural default or explicit override applies here.
            </p>
          )}
        </div>

        {canShowOverrideEntry && (
          <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="override-task-entry">
            <button
              onClick={onOpenEditOverrideTask}
              className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
              data-testid="edit-override-action"
            >
              {hasExplicitOverride ? 'Edit override' : 'Set override'}
            </button>
          </div>
        )}

        {canShowRepairConflictEntry && (
          <div className="px-4 py-3 border-b border-gray-200 space-y-2" data-testid="repair-conflict-task-entry">
            <button
              onClick={onOpenRepairConflictTask}
              className="w-full text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded px-3 py-2"
              data-testid="repair-conflict-action"
            >
              Repair conflict
            </button>
          </div>
        )}

        <div className="px-4 py-3 border-b border-gray-200">
          {isEmptyContainer && (
            <button
              onClick={onOpenAddProductTask}
              className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2 mb-2"
              data-testid="add-product-action"
            >
              Add product
            </button>
          )}
          <button
            onClick={onStartMoveContainer}
            className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
            data-testid="move-container-action"
          >
            Move container
          </button>
        </div>

        <SectionHeader title="Inventory" />
        <div className="px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Empty container</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((row, idx) => {
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
            </div>
          )}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
