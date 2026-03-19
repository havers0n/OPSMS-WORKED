import { Package } from 'lucide-react';

/**
 * Placement mode — empty-state panel shown when no cell or container is selected.
 * Selecting a cell routes to CellPlacementInspector; selecting a container routes
 * to ContainerPlacementInspector.
 */
export function PlacementModePanel() {
  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Placement
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Package className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">Cell Occupancy</p>
          <p className="mt-1 text-xs text-slate-400">
            Inspect which containers are stored in which cells.
          </p>
          <p className="mt-3 text-[11px] text-slate-300">
            Select a cell or rack to see occupancy.
          </p>
        </div>
      </div>
    </aside>
  );
}
