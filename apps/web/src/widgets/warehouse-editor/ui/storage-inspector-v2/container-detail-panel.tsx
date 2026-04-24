import type { LocationStorageSnapshotRow } from '@wos/domain';
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
  canShowOverrideEntry: boolean;
  hasExplicitOverride: boolean;
  canShowRepairConflictEntry: boolean;
  isEmptyContainer: boolean;
  onBack: () => void;
  onOpenEditOverrideTask: () => void;
  onOpenRepairConflictTask: () => void;
  onOpenAddProductTask: () => void;
  onStartMoveContainer: () => void;
  onOpenRemoveContainerTask: () => void;
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
  onStartMoveContainer,
  onOpenRemoveContainerTask
}: ContainerDetailPanelProps) {
  return (
    <div
      className={inspectorShellClassName}
      role="complementary"
      aria-label={`Container detail: ${displayCode}`}
    >
      <div className={inspectorSectionClassName}>
        <button
          onClick={onBack}
          className="mb-2 text-xs text-blue-600 hover:text-blue-800"
          aria-label="Back to cell overview"
        >
          ← Back
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
            <div className="mt-1 text-xs text-gray-500">
              {rackDisplayCode} / Level {activeLevel} / <span className="font-mono text-gray-900">{locationCode}</span>
            </div>
          </div>
          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            Container
          </span>
        </div>
        {firstRow ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="capitalize">Type: {firstRow.containerType}</span>
            <span className="capitalize">Status: {firstRow.containerStatus}</span>
          </div>
        ) : null}
      </div>

      <div className={inspectorScrollBodyClassName}>
        <div className={inspectorSectionClassName} data-testid="location-role-context">
          <div className={inspectorSectionTitleClassName}>Location Role</div>
          <div className="mt-2 space-y-1.5 text-xs text-gray-700">
            {selectedProduct ? (
              <p>
                SKU: <span className="font-mono text-gray-900">{selectedProduct.sku ?? selectedProduct.name}</span>
              </p>
            ) : null}
            <p>
              Structural default: <span className="font-medium text-gray-900">{structuralDefaultText}</span>
            </p>
            <p>
              Effective role: <span className="font-medium text-gray-900">{effectiveRoleText}</span>
            </p>
            <p>
              Source: <span className="font-medium text-gray-900">{sourceText}</span>
            </p>
          </div>
          {!hasProductContext ? (
            <div className="mt-2 text-[11px] leading-5 text-gray-500" data-testid="location-role-product-context-required">
              Product context required to resolve explicit override.
            </div>
          ) : null}
          {isConflict ? (
            <div className="mt-2 text-[11px] leading-5 text-amber-700" data-testid="location-role-conflict-note">
              Multiple published explicit roles exist for this product/location.
            </div>
          ) : null}
          {showNoneExplanation ? (
            <div className="mt-2 text-[11px] leading-5 text-gray-500" data-testid="location-role-none-note">
              No structural default or explicit override applies here.
            </div>
          ) : null}
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>Actions</div>
          <div className="mt-2 grid gap-1.5">
            {canShowOverrideEntry ? (
              <div data-testid="override-task-entry">
                <button
                  onClick={onOpenEditOverrideTask}
                  className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                  data-testid="edit-override-action"
                >
                  {hasExplicitOverride ? 'Edit override' : 'Set override'}
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
                  Repair conflict
                </button>
              </div>
            ) : null}

            {isEmptyContainer ? (
              <button
                onClick={onOpenAddProductTask}
                className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                data-testid="add-product-action"
              >
                Add product
              </button>
            ) : null}

            <button
              onClick={onStartMoveContainer}
              className="h-8 w-full rounded-sm border border-gray-300 bg-white px-3 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              data-testid="move-container-action"
            >
              Move container
            </button>
            <button
              onClick={onOpenRemoveContainerTask}
              className="h-8 w-full rounded-sm border border-red-200 bg-white px-3 text-left text-sm text-red-700 hover:border-red-300 hover:bg-red-50"
              data-testid="remove-container-action"
            >
              Remove from location
            </button>
          </div>
        </div>

        <div className={inspectorSectionClassName}>
          <div className={inspectorSectionTitleClassName}>Inventory</div>
          {items.length === 0 ? (
            <div className="mt-2 text-xs text-gray-400">Empty container</div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {items.map((row, idx) => {
                const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '-';
                const qty = row.quantity ?? 0;
                const uom = row.uom ?? '';
                return (
                  <div key={`${row.containerId}-${row.itemRef ?? idx}`} className={inspectorRowCardClassName}>
                    <div className="min-w-0 flex-1 text-xs text-gray-600">
                      {row.product?.sku ? (
                        <span className="font-mono text-[11px] text-gray-500">{row.product.sku}</span>
                      ) : null}
                      <span className="ml-1.5 truncate">{label}</span>
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
