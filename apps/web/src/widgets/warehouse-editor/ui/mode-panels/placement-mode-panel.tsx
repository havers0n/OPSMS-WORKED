import { MousePointer2 } from 'lucide-react';
import { useViewMode } from '@/entities/layout-version/model/editor-selectors';

/**
 * View/Storage mode empty-state panel shown when no rack, cell, or container is selected.
 * Selecting a cell routes to CellPlacementInspector; selecting a container routes
 * to ContainerPlacementInspector.
 */
export function PlacementModePanel() {
  const viewMode = useViewMode();
  const isReadOnlyView = viewMode === 'view';

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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <MousePointer2 className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">No object selected</p>
          <p className="mt-1 text-xs text-slate-400">
            Selection details appear here after a rack, cell, or container is selected.
          </p>
        </div>
      </div>
    </aside>
  );
}
