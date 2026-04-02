import { Eye, Package } from 'lucide-react';
import { useViewMode } from '@/entities/layout-version/model/editor-selectors';

/**
 * View/Storage mode empty-state panel shown when no cell or container is selected.
 * Selecting a cell routes to CellPlacementInspector; selecting a container routes
 * to ContainerPlacementInspector.
 */
export function PlacementModePanel() {
  const viewMode = useViewMode();
  const isReadOnlyView = viewMode === 'view';
  const Icon = isReadOnlyView ? Eye : Package;

  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {isReadOnlyView ? 'View' : 'Storage'}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">
            {isReadOnlyView ? 'Browse warehouse' : 'Cell Occupancy'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {isReadOnlyView
              ? 'Select a rack, cell, or container to inspect read-only detail.'
              : 'Inspect which containers are stored in which cells.'}
          </p>
          <p className="mt-3 text-[11px] text-slate-300">
            {isReadOnlyView
              ? 'View mode has no mutation actions or workflow launchers.'
              : 'Select a cell to inspect or place inventory.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
