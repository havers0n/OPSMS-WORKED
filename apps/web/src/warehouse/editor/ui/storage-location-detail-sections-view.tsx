import { ChevronRight, Layers, Package, ShieldCheck } from 'lucide-react';
import { useT } from '@/shared/i18n';

type Translator = ReturnType<typeof useT>;

const CONTAINER_STATUS_STYLES: Record<string, { labelKey: Parameters<Translator>[0]; className: string }> = {
  active: { labelKey: 'storage.status.active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { labelKey: 'storage.status.quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { labelKey: 'storage.status.closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost: { labelKey: 'storage.status.lost', className: 'bg-red-50 text-red-600 border-red-200' },
  damaged: { labelKey: 'storage.status.damaged', className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

const ROLE_STYLES: Record<string, { labelKey: Parameters<Translator>[0]; className: string }> = {
  primary_pick: { labelKey: 'storage.role.primaryPickSentence', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  reserve: { labelKey: 'storage.role.reserve', className: 'bg-amber-50 text-amber-700 border-amber-200' }
};

function ContainerStatusBadge({ status }: { status: string }) {
  const t = useT();
  const statusStyle = CONTAINER_STATUS_STYLES[status];
  const label = statusStyle ? t(statusStyle.labelKey) : status;
  const className = statusStyle?.className ?? 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function LocationPolicyRoleBadge({ role }: { role: string }) {
  const t = useT();
  const roleStyle = ROLE_STYLES[role];
  const label = roleStyle ? t(roleStyle.labelKey) : role;
  const className = roleStyle?.className ?? 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export type CurrentContainerCardViewModel = {
  containerId: string;
  title: string;
  secondaryText: string;
  status: string;
  presetUsageText?: string;
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
  const t = useT();

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Layers className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('storage.field.currentContainers')}
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)]">
        <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
          {t('storage.field.currentContainers')}
        </div>

        {containers.length === 0 ? (
          <div className="border-t border-[var(--border-muted)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
            {t('storage.status.empty')}
          </div>
        ) : (
          <div className="border-t border-[var(--border-muted)] flex flex-col gap-2 px-3 py-3">
            {containers.map((container) => (
              <button
                key={container.containerId}
                type="button"
                className="w-full rounded-lg text-start transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
                style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
                onClick={() => onContainerClick(container.containerId, sourceCellId)}
                aria-label={t('storage.inspector.viewContainer', { containerCode: container.title })}
                data-testid="storage-shell-container-entry"
              >
                <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {container.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{container.secondaryText}</p>
                    {container.presetUsageText ? (
                      <p className="mt-1 text-[10px] font-medium text-[var(--text-muted)]">{container.presetUsageText}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ContainerStatusBadge status={container.status} />
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="border-t border-[var(--border-muted)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  {container.inventoryEntryCount > 0
                    ? t('storage.inventory.entriesRecorded', { count: container.inventoryEntryCount })
                    : t('storage.state.emptyContainer')}
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
  const t = useT();

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Package className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('storage.field.currentInventory')}
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)]">
        <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">
          {t('storage.field.currentInventory')}
        </div>

        {inventoryItems.length === 0 ? (
          <div className="border-t border-[var(--border-muted)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
            {hasContainers
              ? t('storage.inventory.noInventoryInContainers')
              : t('storage.inventory.noContainersInventory')}
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
                      {t('storage.state.inventoryLine')}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[var(--text-primary)]">{item.title}</p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">{item.meta ?? t('storage.inventory.noSkuMetadata')}</p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-xs text-[var(--text-primary)]">
                    {item.totalQuantity} {item.uom}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {t('storage.inventory.containerCount', { count: item.containerCount })}
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
  const t = useT();

  return (
    <div
      className="rounded-lg"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('storage.field.locationPolicy')}
        </span>
      </div>

      <div className="border-t border-[var(--border-muted)] px-3 py-3" data-testid="cell-placement-policy-summary">
        <p className="text-[11px] text-[var(--text-muted)]">
          {t('storage.policy.description')}
        </p>

        {isPending ? (
          <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
            {t('storage.policy.loadingAssignments')}
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
            {t('storage.policy.noSkuPolicies')}
          </div>
        ) : (
          <div className="mt-3 rounded border border-[var(--border-muted)] bg-[var(--surface-primary)]">
            <div className="border-b border-[var(--border-muted)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
              {t('storage.policy.assignmentCount', { count: assignments.length })}
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
              {t('storage.action.editPolicy')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
