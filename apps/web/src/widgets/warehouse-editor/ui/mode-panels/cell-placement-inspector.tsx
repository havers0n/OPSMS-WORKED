import { MapPin, Package, AlertCircle, Loader2, Layers, CloudOff, ChevronRight } from 'lucide-react';
import type { CellStorageSnapshotRow } from '@wos/domain';
import { generateRackCells } from '@wos/domain';
import {
  useEditorSelection,
  useLayoutDraftState,
  useSetSelectedContainerId
} from '@/entities/layout-version/model/editor-selectors';
import { useCellSlotStorage } from '@/entities/cell/api/use-cell-slot-storage';
import { parseCellSelectionKey } from '@/entities/cell/lib/cell-selection-key';

// ─── container status badge ───────────────────────────────────────────────────

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
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

// ─── grouping helpers ─────────────────────────────────────────────────────────

type ContainerGroup = {
  containerId: string;
  externalCode: string | null;
  containerType: string;
  containerStatus: string;
  placedAt: string;
  items: Array<{ itemRef: string; quantity: number; uom: string }>;
};

function groupByContainer(rows: CellStorageSnapshotRow[]): ContainerGroup[] {
  const map = new Map<string, ContainerGroup>();

  for (const row of rows) {
    if (!map.has(row.containerId)) {
      map.set(row.containerId, {
        containerId: row.containerId,
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

// ─── sub-panels ───────────────────────────────────────────────────────────────

type ContainerCardProps = {
  group: ContainerGroup;
  /** Called when the user clicks to drill into this container. */
  onContainerClick: (containerId: string) => void;
};

function ContainerCard({ group, onContainerClick }: ContainerCardProps) {
  return (
    <button
      type="button"
      className="w-full rounded-lg text-left transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
      style={{ border: '1px solid var(--border-muted)', background: 'var(--surface-subtle)' }}
      onClick={() => onContainerClick(group.containerId)}
    >
      {/* Container header */}
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {group.externalCode ?? <span className="text-[var(--text-muted)]">No code</span>}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {group.containerType} &middot; placed {formatDate(group.placedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={group.containerStatus} />
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </div>
      </div>

      {/* Inventory items */}
      {group.items.length > 0 ? (
        <div className="border-t border-[var(--border-muted)] px-3 py-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Inventory
          </p>
          <div className="flex flex-col gap-1">
            {group.items.map((item, i) => (
              <div key={`${item.itemRef}-${i}`} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-[var(--text-primary)]">
                  {item.itemRef}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {item.quantity} {item.uom}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--border-muted)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
          No inventory items
        </div>
      )}
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

/**
 * CellPlacementInspector — read-only placement inspector for a selected cell slot.
 *
 * Shows containers currently placed in this cell (across all levels) and their
 * inventory content. Backed by /api/rack-sections/:sectionId/slots/:slotNo/storage.
 *
 * Empty states:
 *   - Unparseable key          → malformed selection (shouldn't happen in normal flow)
 *   - Query loading            → spinner
 *   - Query error              → error message
 *   - Empty result             → "No containers / layout not published"
 *   - Containers present       → container cards with inventory
 *
 * B3 TODO: Add place/remove/move actions once mutation UI is approved.
 */
export function CellPlacementInspector() {
  const selection = useEditorSelection();
  const layoutDraft = useLayoutDraftState();
  const setSelectedContainerId = useSetSelectedContainerId();

  const cellId = selection.type === 'cell' ? selection.cellId : null;
  const parsed = cellId ? parseCellSelectionKey(cellId) : null;

  // Resolve cell address from draft (no extra network call).
  const cellAddress = (() => {
    if (!parsed || !layoutDraft) return null;
    const rack = layoutDraft.racks[parsed.rackId];
    if (!rack) return null;
    const cells = generateRackCells(layoutDraft.layoutVersionId, rack);
    const match = cells.find(
      (c) => c.rackSectionId === parsed.sectionId && c.slotNo === parsed.slotNo
    );
    return match?.address ?? null;
  })();

  const { data, isPending, isError } = useCellSlotStorage(
    parsed?.sectionId ?? null,
    parsed?.slotNo ?? null
  );

  const isPublished = data?.published ?? false;
  const containers = data ? groupByContainer(data.rows) : [];

  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      {/* Header */}
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Placement
        </div>
        <div className="mt-1 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {cellAddress?.raw ?? cellId ?? '—'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {/* Malformed key guard */}
        {!parsed && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-400">Cell selection could not be resolved.</p>
          </div>
        )}

        {/* Loading */}
        {parsed && isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        )}

        {/* Error */}
        {parsed && isError && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load placement data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Check your connection and try again.</p>
          </div>
        )}

        {/* STATE A — layout not published; cells don't exist in DB yet */}
        {parsed && !isPending && !isError && !isPublished && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CloudOff className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Layout not published</p>
              <p className="mt-1 text-xs text-slate-400">
                Publish the layout to enable storage placement.
              </p>
            </div>
          </div>
        )}

        {/* STATE B — layout published, slot is genuinely empty */}
        {parsed && !isPending && !isError && isPublished && containers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Package className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">No containers</p>
              <p className="mt-1 text-xs text-slate-400">This cell is empty.</p>
            </div>
          </div>
        )}

        {/* STATE C — layout published, containers present */}
        {parsed && !isPending && !isError && isPublished && containers.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              <Layers className="h-3 w-3" />
              <span>{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
            </div>
            {containers.map((group) => (
              <ContainerCard
                key={group.containerId}
                group={group}
                onContainerClick={setSelectedContainerId}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
