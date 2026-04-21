import { useEffect, useState } from 'react';
import type { LocationStorageSnapshotRow } from '@wos/domain';
import { Loader2, Package, ShieldCheck, X } from 'lucide-react';
import {
  useStorageSetSelectedContainerId,
  useStorageStartCreateAndPlaceWorkflow,
  useStorageStartPlaceContainerWorkflow
} from '@/widgets/warehouse-editor/model/storage-ui-facade';
import { getProductImageUrl, getProductLabel, getProductMeta } from '@/entities/product/lib/display';
import {
  getContainerDisplayLabel,
  getContainerDisplaySecondary,
  summarizeInventory
} from './mode-panels/cell-placement-inspector.lib';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import { useCreateProductLocationRole, useDeleteProductLocationRole } from '@/entities/product-location-role/api/mutations';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicyRoleBadge,
  LocationPolicySummarySectionView,
  type CurrentContainerCardViewModel,
  type CurrentInventorySummaryItemViewModel
} from './storage-location-detail-sections-view';

type PlacementPanelMode = 'details' | 'task';
type PlacementTaskType = 'edit-policy' | null;

type ContainerGroup = {
  containerId: string;
  systemCode: string;
  externalCode: string | null;
  containerType: string;
  containerStatus: string;
  placedAt: string;
  items: Array<{ itemRef: string; product: LocationStorageSnapshotRow['product']; quantity: number; uom: string }>;
};

function groupByContainer(rows: LocationStorageSnapshotRow[]): ContainerGroup[] {
  const map = new Map<string, ContainerGroup>();

  for (const row of rows) {
    if (!map.has(row.containerId)) {
      map.set(row.containerId, {
        containerId: row.containerId,
        systemCode: row.systemCode,
        externalCode: row.externalCode,
        containerType: row.containerType,
        containerStatus: row.containerStatus,
        placedAt: row.placedAt,
        items: []
      });
    }

    if (row.itemRef !== null && row.quantity !== null && row.uom !== null) {
      map.get(row.containerId)!.items.push({
        itemRef: row.itemRef,
        product: row.product,
        quantity: row.quantity,
        uom: row.uom
      });
    }
  }

  return [...map.values()];
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type LocationPolicySectionProps = {
  locationId: string;
  mode: 'summary' | 'editor';
  onEdit?: () => void;
};

function LocationPolicySection({ locationId, mode, onEdit }: LocationPolicySectionProps) {
  const { data: assignments = [], isPending } = useLocationProductAssignments(locationId);
  const createAssignment = useCreateProductLocationRole();
  const deleteAssignment = useDeleteProductLocationRole(locationId);

  const [showForm, setShowForm] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductLabel, setSelectedProductLabel] = useState('');
  const [role, setRole] = useState<'primary_pick' | 'reserve'>('primary_pick');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: searchResults = [] } = useProductsSearch(
    productQuery.trim().length > 0 ? productQuery : null
  );

  const handleAssign = async () => {
    if (!selectedProductId) return;
    setFormError(null);
    try {
      await createAssignment.mutateAsync({ locationId, productId: selectedProductId, role });
      setShowForm(false);
      setProductQuery('');
      setSelectedProductId(null);
      setSelectedProductLabel('');
      setRole('primary_pick');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not assign product.');
    }
  };

  const handleDelete = async (roleId: string) => {
    setPendingDeleteId(roleId);
    try {
      await deleteAssignment.mutateAsync(roleId);
    } catch {
      // silent — the list will not change
    } finally {
      setPendingDeleteId(null);
    }
  };

  if (mode === 'summary') {
    return (
      <LocationPolicySummarySectionView
        isPending={isPending}
        assignments={assignments.map((assignment) => ({
          id: assignment.id,
          productName: assignment.product.name,
          productSku: assignment.product.sku,
          role: assignment.role
        }))}
        onEdit={onEdit}
      />
    );
  }

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Location Policy
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)]" data-testid="cell-placement-policy-editor">
          <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
            Policies describe the intended operational use of this location. They do not guarantee
            that stock is currently here.
          </div>

          {isPending ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : assignments.length === 0 && !showForm ? (
            <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
              <p>No SKU policies are assigned to this location.</p>
              <p className="mt-1">Containers or inventory may still be present here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {a.product.imageUrl ? (
                      <img
                        src={a.product.imageUrl}
                        alt={a.product.name}
                        className="h-7 w-7 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[9px] text-[var(--text-muted)]"
                        style={{ background: 'var(--surface-primary)' }}
                      >
                        SKU
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {a.product.name}
                      </p>
                      {a.product.sku && (
                        <p className="truncate text-[10px] text-[var(--text-muted)]">
                          {a.product.sku}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <LocationPolicyRoleBadge role={a.role} />
                    <button
                      type="button"
                      className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                      onClick={() => void handleDelete(a.id)}
                      disabled={pendingDeleteId === a.id || deleteAssignment.isPending}
                      title="Remove policy"
                    >
                      {pendingDeleteId === a.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm && (
          <div className="border-t border-[var(--border-muted)] px-3 py-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Add SKU policy
            </p>
            {selectedProductId ? (
              <div className="mb-2 flex items-center justify-between rounded border border-[var(--border-muted)] bg-[var(--surface-primary)] px-2.5 py-1.5">
                <span className="text-xs text-[var(--text-primary)]">{selectedProductLabel}</span>
                <button
                  type="button"
                  className="ml-2 text-[var(--text-muted)] hover:text-red-500"
                  onClick={() => {
                    setSelectedProductId(null);
                    setSelectedProductLabel('');
                    setProductQuery('');
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="mb-2">
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search by name or SKU…"
                  className="w-full rounded border px-2.5 py-1.5 text-xs outline-none"
                  style={{
                    borderColor: 'var(--border-muted)',
                    background: 'var(--surface-primary)'
                  }}
                />
                {productQuery.trim().length > 0 && searchResults.length > 0 && (
                  <div
                    className="mt-1 max-h-36 overflow-y-auto rounded border"
                    style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                  >
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-subtle)]"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setSelectedProductLabel(
                            [p.name, p.sku].filter(Boolean).join(' · ')
                          );
                          setProductQuery('');
                        }}
                      >
                        <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                        {p.sku && (
                          <span className="ml-1.5 text-[var(--text-muted)]">{p.sku}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {productQuery.trim().length > 0 && searchResults.length === 0 && (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">No products found.</p>
                )}
              </div>
            )}

            <div className="mb-2 flex items-center gap-3">
              {(['primary_pick', 'reserve'] as const).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="radio"
                    name="policy-role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="accent-[var(--accent)]"
                  />
                  {r === 'primary_pick' ? 'Primary pick' : 'Reserve'}
                </label>
              ))}
            </div>

            {formError && <p className="mb-2 text-[11px] text-red-500">{formError}</p>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
                onClick={() => void handleAssign()}
                disabled={!selectedProductId || createAssignment.isPending}
              >
                {createAssignment.isPending ? 'Saving…' : 'Save policy'}
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setShowForm(false);
                  setProductQuery('');
                  setSelectedProductId(null);
                  setSelectedProductLabel('');
                  setFormError(null);
                }}
                disabled={createAssignment.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <div className="px-3 py-2">
            <button
              type="button"
              className="text-[11px] font-medium text-[var(--accent)] hover:underline disabled:opacity-40"
              onClick={() => setShowForm(true)}
              disabled={createAssignment.isPending}
            >
              + Add SKU policy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function mapContainersToView(containers: ContainerGroup[]): CurrentContainerCardViewModel[] {
  return containers.map((group) => ({
    containerId: group.containerId,
    title: getContainerDisplayLabel(group),
    secondaryText: getContainerDisplaySecondary({
      externalCode: group.externalCode,
      containerType: group.containerType,
      placedAt: formatDate(group.placedAt)
    }),
    status: group.containerStatus,
    inventoryEntryCount: group.items.length
  }));
}

function mapInventoryToView(rows: LocationStorageSnapshotRow[]): CurrentInventorySummaryItemViewModel[] {
  return summarizeInventory(rows).map((item) => ({
    key: item.key,
    imageUrl: getProductImageUrl(item.product),
    title: getProductLabel(item.itemRef, item.product),
    meta: getProductMeta(item.itemRef, item.product),
    totalQuantity: item.totalQuantity,
    uom: item.uom,
    containerCount: item.containerCount
  }));
}

function PlacementActionsSection({
  selectedCellId,
  isDisabled
}: {
  selectedCellId: string;
  isDisabled: boolean;
}) {
  const startPlaceContainerWorkflow = useStorageStartPlaceContainerWorkflow();
  const startCreateAndPlaceWorkflow = useStorageStartCreateAndPlaceWorkflow();

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
      data-testid="cell-placement-actions"
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Package className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Placement actions
        </span>
      </div>
      <div className="border-t border-[var(--border-muted)] px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
            onClick={() => startPlaceContainerWorkflow(selectedCellId)}
            disabled={isDisabled}
          >
            Place existing
          </button>
          <button
            type="button"
            className="rounded-md border px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
            onClick={() => startCreateAndPlaceWorkflow(selectedCellId)}
            disabled={isDisabled}
          >
            Create + place
          </button>
        </div>
      </div>
    </div>
  );
}

type OperationalCell = {
  id: string;
  address: {
    raw: string;
  };
};

export function CellPlacementOperationalBody({
  selectedCell,
  locationId,
  rows,
  isReadOnlyView
}: {
  selectedCell: OperationalCell;
  locationId: string;
  rows: LocationStorageSnapshotRow[];
  isReadOnlyView: boolean;
}) {
  const setSelectedContainerId = useStorageSetSelectedContainerId();
  const [panelMode, setPanelMode] = useState<PlacementPanelMode>('details');
  const [taskType, setTaskType] = useState<PlacementTaskType>(null);

  const containers = groupByContainer(rows);
  const containerCards = mapContainersToView(containers);
  const inventoryItems = mapInventoryToView(rows);
  const isOccupied = containers.length > 0;

  const enterTaskMode = (nextTaskType: Exclude<PlacementTaskType, null>) => {
    setPanelMode('task');
    setTaskType(nextTaskType);
  };

  const returnToDetails = () => {
    setPanelMode('details');
    setTaskType(null);
  };

  useEffect(() => {
    setPanelMode('details');
    setTaskType(null);
  }, [selectedCell.id]);

  useEffect(() => {
    if (!isReadOnlyView) return;
    setPanelMode('details');
    setTaskType(null);
  }, [isReadOnlyView]);

  const taskTitle = taskType === 'edit-policy' ? 'Edit location policy' : '';
  const showDetailsMode = isReadOnlyView || panelMode === 'details';
  const showTaskMode = !isReadOnlyView && panelMode === 'task' && taskType !== null;

  return (
    <>
      {showTaskMode && (
        <section
          className="flex min-h-full flex-col rounded-xl border shadow-sm"
          style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
          data-testid="cell-placement-task-shell"
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-subtle)' }}
            data-testid="cell-placement-task-header"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Policy editor
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{taskTitle}</p>
            </div>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
              style={{ borderColor: 'var(--border-muted)' }}
              onClick={returnToDetails}
            >
              Back
            </button>
          </div>

          <div className="flex-1 px-4 py-4" data-testid="cell-placement-task-body">
            {taskType === 'edit-policy' && (
              <div data-testid="cell-placement-task-edit-policy">
                <LocationPolicySection locationId={locationId} mode="editor" />
              </div>
            )}
          </div>
        </section>
      )}

      {showDetailsMode && (
        <>
          <CurrentContainersSectionView
            containers={containerCards}
            sourceCellId={selectedCell.id}
            onContainerClick={setSelectedContainerId}
          />
          <CurrentInventorySectionView inventoryItems={inventoryItems} hasContainers={isOccupied} />
          {!isReadOnlyView && (
            <PlacementActionsSection
              selectedCellId={selectedCell.id}
              isDisabled={locationId.length === 0}
            />
          )}
          <LocationPolicySection
            locationId={locationId}
            mode="summary"
            onEdit={isReadOnlyView ? undefined : () => enterTaskMode('edit-policy')}
          />
        </>
      )}
    </>
  );
}
