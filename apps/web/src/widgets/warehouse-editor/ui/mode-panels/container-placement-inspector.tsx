import { Box, AlertCircle, Loader2, ArrowLeft, PackageOpen } from 'lucide-react';
import type { ContainerStorageSnapshotRow } from '@wos/domain';
import {
  useEditorSelection,
  useSetSelectedContainerId
} from '@/entities/layout-version/model/editor-selectors';
import { useContainerStorage } from '@/entities/container/api/use-container-storage';

// ─── container status badge (shared style map) ────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active:      { label: 'Active',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { label: 'Quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed:      { label: 'Closed',      className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost:        { label: 'Lost',        className: 'bg-red-50 text-red-600 border-red-200' },
  damaged:     { label: 'Damaged',     className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, className: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

// ─── inventory row list ───────────────────────────────────────────────────────

type InventoryRow = { itemRef: string; quantity: number; uom: string };

function extractInventory(rows: ContainerStorageSnapshotRow[]): InventoryRow[] {
  return rows
    .filter((r) => r.itemRef !== null && r.quantity !== null && r.uom !== null)
    .map((r) => ({ itemRef: r.itemRef!, quantity: r.quantity!, uom: r.uom! }));
}

// ─── main component ───────────────────────────────────────────────────────────

/**
 * ContainerPlacementInspector — read-only container drill-down for Placement mode.
 *
 * Reached by clicking a container entry in CellPlacementInspector.
 * Backed by GET /api/containers/:containerId/storage.
 *
 * Shows:
 *   - container identity: externalCode, containerType, containerStatus
 *   - inventory rows: itemRef, quantity, uom
 *
 * Empty states:
 *   - Loading             → spinner
 *   - Error               → error card
 *   - No rows returned    → container not found or no data
 *   - Rows, no inventory  → container exists but empty
 *   - Rows with inventory → full inventory list
 *
 * "← Back" clears selection, returning user to placement-placeholder (re-select a cell).
 * No mutation UI. No place/remove/move actions (deferred to B4+).
 */
export function ContainerPlacementInspector() {
  const selection = useEditorSelection();
  const setSelectedContainerId = useSetSelectedContainerId();

  const containerId = selection.type === 'container' ? selection.containerId : null;

  const { data: rows, isPending, isError } = useContainerStorage(containerId);

  // All rows share the same identity fields — take the first row as the source of truth.
  const identity = rows && rows.length > 0 ? rows[0] : null;
  const inventory = rows ? extractInventory(rows) : [];

  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      {/* Header */}
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        {/* Back button */}
        <button
          type="button"
          onClick={() => setSelectedContainerId(null)}
          className="mb-3 flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>

        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Container
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Box className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {identity?.externalCode ?? containerId ?? '—'}
          </span>
        </div>
        {identity && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">{identity.containerType}</span>
            <StatusBadge status={identity.containerStatus} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {/* Loading */}
        {isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load container data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Check your connection and try again.</p>
          </div>
        )}

        {/* Not found — BFF returned 0 rows for this containerId */}
        {!isPending && !isError && rows && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Container not found</p>
              <p className="mt-1 text-xs text-slate-400">
                No data is available for this container.
              </p>
            </div>
          </div>
        )}

        {/* Inventory section */}
        {!isPending && !isError && identity && (
          <>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Inventory
            </p>

            {inventory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <PackageOpen className="h-7 w-7 text-slate-300" />
                <p className="text-xs text-slate-400">This container has no inventory items.</p>
              </div>
            ) : (
              <div
                className="rounded-lg"
                style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
              >
                {inventory.map((item, i) => (
                  <div
                    key={`${item.itemRef}-${i}`}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                    style={i > 0 ? { borderTop: '1px solid var(--border-muted)' } : undefined}
                  >
                    <span className="truncate font-mono text-xs text-[var(--text-primary)]">
                      {item.itemRef}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      {item.quantity} {item.uom}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
