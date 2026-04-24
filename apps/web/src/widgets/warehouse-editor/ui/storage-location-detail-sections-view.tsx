import { ChevronRight, Layers, Package, ShieldCheck } from 'lucide-react';

const CONTAINER_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { label: 'Quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost: { label: 'Lost', className: 'bg-red-50 text-red-600 border-red-200' },
  damaged: { label: 'Damaged', className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  primary_pick: { label: 'Primary pick', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  reserve: { label: 'Reserve', className: 'bg-amber-50 text-amber-700 border-amber-200' }
};

function ContainerStatusBadge({ status }: { status: string }) {
  const style =
    CONTAINER_STATUS_STYLES[status] ?? {
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

export function LocationPolicyRoleBadge({ role }: { role: string }) {
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

export type CurrentContainerCardViewModel = {
  containerId: string;
  title: string;
  secondaryText: string;
  status: string;
  inventoryEntryCount: number;
};

export function CurrentContainersSectionView({
  containers,
  sourceCellId,
  onContainerClick
}: {
  containers: CurrentContainerCardViewModel[];
  sourceCellId: string | null;
  onContainerClick: (containerId: string, sourceCellId: string | null) => void;
}) {
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
            {containers.map((container) => (
              <button
                key={container.containerId}
                type="button"
                className="w-full rounded-lg text-left transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
                style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
                onClick={() => onContainerClick(container.containerId, sourceCellId)}
                aria-label={`View container ${container.title}`}
                data-testid="storage-shell-container-entry"
              >
                <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {container.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{container.secondaryText}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ContainerStatusBadge status={container.status} />
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="border-t border-[var(--border-muted)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  {container.inventoryEntryCount > 0
                    ? `${container.inventoryEntryCount} inventory entr${
                        container.inventoryEntryCount === 1 ? 'y' : 'ies'
                      } recorded inside`
                    : 'No inventory is currently recorded inside this container.'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type CurrentInventorySummaryItemViewModel = {
  key: string;
  imageUrl: string | null;
  title: string;
  meta: string | null;
  totalQuantity: number;
  uom: string;
  containerCount: number;
};

export function CurrentInventorySectionView({
  inventoryItems,
  hasContainers
}: {
  inventoryItems: CurrentInventorySummaryItemViewModel[];
  hasContainers: boolean;
}) {
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

        {inventoryItems.length === 0 ? (
          <div className="border-t border-[var(--border-muted)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
            {hasContainers
              ? 'Containers are present, but no inventory is currently recorded inside them.'
              : 'No current inventory because no containers are placed at this location.'}
          </div>
        ) : (
          <div className="border-t border-[var(--border-muted)]">
            {inventoryItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                      style={{ background: 'var(--surface-primary)' }}
                    >
                      Item
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[var(--text-primary)]">{item.title}</p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">{item.meta ?? 'No SKU metadata'}</p>
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

export type LocationPolicySummaryAssignmentViewModel = {
  id: string;
  productName: string;
  productSku: string | null;
  role: string;
};

export function LocationPolicySummarySectionView({
  isPending,
  assignments,
  onEdit
}: {
  isPending: boolean;
  assignments: LocationPolicySummaryAssignmentViewModel[];
  onEdit?: () => void;
}) {
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

      <div className="border-t border-[var(--border-muted)] px-3 py-3" data-testid="cell-placement-policy-summary">
        <p className="text-[11px] text-[var(--text-muted)]">
          Policies describe intended use for this location. They do not guarantee current stock.
        </p>

        {isPending ? (
          <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
            Loading policy assignments...
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
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--border-muted)] px-2.5 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {assignment.productName}
                    </p>
                    {assignment.productSku && (
                      <p className="truncate text-[10px] text-[var(--text-muted)]">{assignment.productSku}</p>
                    )}
                  </div>
                  <LocationPolicyRoleBadge role={assignment.role} />
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
    </div>
  );
}
