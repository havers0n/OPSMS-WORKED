import { X } from 'lucide-react';
import { SpacingTab } from '@/features/rack-configure/ui/spacing-tab';
import { useSelectedRackIds } from '@/warehouse/editor/model/editor-selectors';

/**
 * RackMultiInspector — shown when 2+ racks are selected in Layout mode.
 *
 * Owns the spacing / alignment / distribution controls that are meaningless
 * for a single-rack context. Single-rack structure editing stays in RackInspector.
 */
export function RackMultiInspector({ onClose }: { onClose: () => void }) {
  const selectedRackIds = useSelectedRackIds();

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Multi-Selection
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {selectedRackIds.length} racks selected
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close inspector"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Spacing / alignment controls */}
      <div className="flex-1 overflow-y-auto p-4">
        <SpacingTab />
      </div>
    </aside>
  );
}
