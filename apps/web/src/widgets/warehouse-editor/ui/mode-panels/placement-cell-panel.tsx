import { MapPin } from 'lucide-react';
import { useEditorSelection } from '@/entities/layout-version/model/editor-selectors';

/**
 * Placement mode — cell selected panel.
 *
 * B1: Shows selected cell identity, confirming the routing path is cell-based.
 * B2: Will display cell occupancy data from the storage layer
 *     (CellStorageSnapshot, ContainerPlacement).
 */
export function PlacementCellPanel() {
  const selection = useEditorSelection();
  const cellId = selection.type === 'cell' ? selection.cellId : null;

  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Placement
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
          Cell Selected
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {cellId && (
          <div
            className="rounded-lg px-3 py-2"
            style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border-muted)'
            }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Cell
            </p>
            <p className="mt-0.5 break-all font-mono text-xs text-[var(--text-primary)]">
              {cellId}
            </p>
          </div>
        )}

        <div className="mt-2 rounded-lg px-3 py-3 text-center">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-slate-300" />
          <p className="text-xs text-slate-400">
            Storage occupancy data is not yet connected.
          </p>
          <p className="mt-1 text-[11px] text-slate-300">Available in a future release.</p>
        </div>
      </div>
    </aside>
  );
}
