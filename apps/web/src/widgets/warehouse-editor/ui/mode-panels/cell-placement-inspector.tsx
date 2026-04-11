import { useEffect, useState } from 'react';
import type { FloorWorkspace, LocationStorageSnapshotRow } from '@wos/domain';
import { AlertCircle, ChevronRight, Layers, Loader2, MapPin, Package, ShieldCheck, X } from 'lucide-react';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  useEditorSelection,
  useSetSelectedContainerId,
  useStartCreateAndPlaceWorkflow,
  useStartPlaceContainerWorkflow,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { getProductImageUrl, getProductLabel, getProductMeta } from '@/entities/product/lib/display';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import {
  getContainerDisplayLabel,
  getContainerDisplaySecondary,
  summarizeInventory
} from './cell-placement-inspector.lib';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import { useCreateProductLocationRole, useDeleteProductLocationRole } from '@/entities/product-location-role/api/mutations';
import { useProductsSearch } from '@/entities/product/api/use-products-search';

type PlacementPanelMode = 'details' | 'task';
type PlacementTaskType = 'edit-policy' | null;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { label: 'Quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost: { label: 'Lost', className: 'bg-red-50 text-red-600 border-red-200' },
  damaged: { label: 'Damaged', className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? {
      label: status,
      className: 'bg-slate-100 text-slate-500 border-slate-200'
    };

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

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

type ContainerCardProps = {
  group: ContainerGroup;
  onContainerClick: (containerId: string, sourceCellId: string | null) => void;
  sourceCellId: string | null;
};

function ContainerCard({ group, onContainerClick, sourceCellId }: ContainerCardProps) {
  return (
    <button
      type="button"
      className="w-full rounded-lg text-left transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
      onClick={() => onContainerClick(group.containerId, sourceCellId)}
      data-testid="storage-shell-container-entry"
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {getContainerDisplayLabel(group)}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {getContainerDisplaySecondary({
              externalCode: group.externalCode,
              containerType: group.containerType,
              placedAt: formatDate(group.placedAt)
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={group.containerStatus} />
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </div>
      </div>
      <div className="border-t border-[var(--border-muted)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
        {group.items.length > 0
          ? `${group.items.length} inventory entr${group.items.length === 1 ? 'y' : 'ies'} recorded inside`
          : 'No inventory is currently recorded inside this container.'}
      </div>
    </button>
  );
}

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  primary_pick: { label: 'Primary pick', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  reserve: { label: 'Reserve', className: 'bg-amber-50 text-amber-700 border-amber-200' }
};

function RoleBadge({ role }: { role: string }) {
  const style =
    ROLE_STYLES[role] ?? { label: role, className: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
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

      {mode === 'summary' ? (
        <div className="border-t border-[var(--border-muted)] px-3 py-3" data-testid="cell-placement-policy-summary">
          <p className="text-[11px] text-[var(--text-muted)]">
            Policies describe intended use for this location. They do not guarantee current stock.
          </p>

          {isPending ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
              No SKU policies are assigned to this location.
            </div>
          ) : (
            <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)]">
              <div className="border-b border-[var(--border-muted)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
                {assignments.length} policy assignment{assignments.length === 1 ? '' : 's'}
              </div>
              <div className="flex flex-col">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border-muted)] px-2.5 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {a.product.name}
                      </p>
                      {a.product.sku && (
                        <p className="truncate text-[10px] text-[var(--text-muted)]">{a.product.sku}</p>
                      )}
                    </div>
                    <RoleBadge role={a.role} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {onEdit && (
            <div className="mt-3">
              <button
                type="button"
                className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                onClick={onEdit}
              >
                Edit policy
              </button>
            </div>
          )}
        </div>
      ) : (
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
                    <RoleBadge role={a.role} />
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
                  {ROLE_STYLES[r].label}
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
      )}
    </div>
  );
}

type CurrentContainersSectionProps = {
  containers: ContainerGroup[];
  selectedCellId: string;
  onContainerClick: (containerId: string, sourceCellId: string | null) => void;
};

function CurrentContainersSection({
  containers,
  selectedCellId,
  onContainerClick
}: CurrentContainersSectionProps) {
  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Layers className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Current containers
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)]">
        <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
          Physical containers currently placed at this location.
        </div>

        {containers.length === 0 ? (
          <div className="border-t border-[var(--border-muted)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
            No containers are currently placed at this location.
          </div>
        ) : (
          <div className="border-t border-[var(--border-muted)] flex flex-col gap-2 px-3 py-3">
            {containers.map((group) => (
              <ContainerCard
                key={group.containerId}
                group={group}
                onContainerClick={onContainerClick}
                sourceCellId={selectedCellId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type CurrentInventorySectionProps = {
  rows: LocationStorageSnapshotRow[];
  hasContainers: boolean;
};

function CurrentInventorySection({ rows, hasContainers }: CurrentInventorySectionProps) {
  const inventory = summarizeInventory(rows);

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Package className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Current inventory
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)]">
        <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
          Inventory currently recorded inside containers at this location.
        </div>

        {inventory.length === 0 ? (
          <div className="border-t border-[var(--border-muted)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
            {hasContainers
              ? 'Containers are present, but no inventory is currently recorded inside them.'
              : 'No current inventory because no containers are placed at this location.'}
          </div>
        ) : (
          <div className="border-t border-[var(--border-muted)]">
            {inventory.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {getProductImageUrl(item.product) ? (
                    <img
                      src={getProductImageUrl(item.product)!}
                      alt={getProductLabel(item.itemRef, item.product)}
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                      style={{ background: 'var(--surface-primary)' }}
                    >
                      Item
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[var(--text-primary)]">
                      {getProductLabel(item.itemRef, item.product)}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">
                      {getProductMeta(item.itemRef, item.product)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[var(--text-primary)]">
                    {item.totalQuantity} {item.uom}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {item.containerCount} container{item.containerCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlacementActionsSection({
  selectedCellId,
  isDisabled
}: {
  selectedCellId: string;
  isDisabled: boolean;
}) {
  const startPlaceContainerWorkflow = useStartPlaceContainerWorkflow();
  const startCreateAndPlaceWorkflow = useStartCreateAndPlaceWorkflow();

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
  const setSelectedContainerId = useSetSelectedContainerId();
  const [panelMode, setPanelMode] = useState<PlacementPanelMode>('details');
  const [taskType, setTaskType] = useState<PlacementTaskType>(null);

  const containers = groupByContainer(rows);
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
          <CurrentContainersSection
            containers={containers}
            selectedCellId={selectedCell.id}
            onContainerClick={setSelectedContainerId}
          />
          <CurrentInventorySection rows={rows} hasContainers={isOccupied} />
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

export function CellPlacementInspector({ workspace }: { workspace: FloorWorkspace | null }) {
  const selection = useEditorSelection();
  const viewMode = useViewMode();

  const cellId = selection.type === 'cell' ? selection.cellId : null;
  const isReadOnlyView = viewMode === 'view';
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const selectedCell = publishedCells.find((cell) => cell.id === cellId) ?? null;

  // Debug: locationQuery inputs
  const locationQueryEnabled = Boolean(cellId);
  const locationQueryKey = cellId ? `location-by-cell:${cellId}` : null;
  const { data: locationRef, error: locationQueryError } = useLocationByCell(cellId);

  // Debug: log location query state
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[placement] location query input', {
        cellId,
        selectedCell: selectedCell ? { id: selectedCell.id, address: selectedCell.address } : null,
        enabled: locationQueryEnabled,
        queryKey: locationQueryKey
      });
    }
  }, [cellId, selectedCell, locationQueryEnabled, locationQueryKey]);

  useEffect(() => {
    if (import.meta.env.DEV && locationRef) {
      console.debug('[placement] location query success', locationRef);
    }
    if (import.meta.env.DEV && locationQueryError) {
      console.error('[placement] location query error', locationQueryError);
    }
  }, [locationRef, locationQueryError]);

  const locationId = locationRef?.locationId ?? null;

  const { data = [], error, isPending: isStoragePending, isError } = useLocationStorage(locationId);
  // Spinner should only show while actively loading storage (locationId known, storage fetching).
  // When locationQueryError is set, locationId is null → storage query is disabled → isPending is
  // React Query's initial-pending state, not a real load. Gate on locationId to avoid infinite spinner.
  const isPending = isStoragePending && locationId !== null;

  const bffError = error instanceof BffRequestError ? error : null;
  const locationBffError = locationQueryError instanceof BffRequestError ? locationQueryError : null;

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: 'var(--surface-primary)' }}>
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {isReadOnlyView ? 'View' : 'Storage'}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {selectedCell?.address.raw ?? cellId ?? '—'}
          </span>
        </div>
      </div>

      <div
        className={`flex flex-1 flex-col overflow-y-auto px-4 py-4 ${
          !isReadOnlyView ? 'gap-3' : 'gap-3'
        }`}
        data-testid="cell-placement-details-view"
      >
        {selectedCell && locationId && !isPending && !isError && (
          <CellPlacementOperationalBody
            selectedCell={selectedCell}
            locationId={locationId}
            rows={data}
            isReadOnlyView={isReadOnlyView}
          />
        )}

        {!cellId && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-400">Select a physical cell to inspect placement.</p>
          </div>
        )}

        {cellId && isPending && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            {import.meta.env.DEV && (
              <div
                className="rounded border border-orange-200 bg-orange-50 p-2 font-mono text-[10px] text-orange-800 max-w-xs text-center"
              >
                <p className="font-semibold">⏳ Loading placement data...</p>
                <p>locationId: {locationId || '(waiting...)'}</p>
                <p>fetching storage: {isPending ? '⏳' : '✓'}</p>
              </div>
            )}
          </div>
        )}

        {cellId && (isError || !!locationQueryError) && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load placement data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {locationBffError?.message ?? bffError?.message ?? 'Check your connection and try again.'}
            </p>
            <div className="mt-2 space-y-0.5 font-mono text-[10px] text-slate-400">
              <p>cellId: {cellId}</p>
              {(locationBffError ?? bffError) && <p>status: {(locationBffError ?? bffError)!.status}</p>}
              {(locationBffError?.code ?? bffError?.code) && <p>code: {locationBffError?.code ?? bffError?.code}</p>}
            </div>
          </div>
        )}

        {cellId && !selectedCell && !isPending && !isError && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Cell is unavailable</p>
              <p className="mt-1 text-xs text-slate-400">
                {isReadOnlyView
                  ? 'View mode requires a published physical cell selection.'
                  : 'Storage mode requires a published physical cell selection.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
