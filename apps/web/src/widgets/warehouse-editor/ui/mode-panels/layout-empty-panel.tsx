import { MousePointer2, PlusCircle } from 'lucide-react';

/**
 * Layout mode — no rack selected.
 * Extracted from RackInspector to live at the router level.
 */
export function LayoutEmptyPanel({ onAddRack }: { onAddRack: () => void }) {
  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Inspector
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <MousePointer2 className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">No rack selected</p>
          <p className="mt-1 text-xs text-slate-400">
            Click a rack on the canvas to inspect it
          </p>
        </div>
        <button
          type="button"
          onClick={onAddRack}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
        >
          <PlusCircle className="h-4 w-4" />
          Add Rack
        </button>
      </div>
    </aside>
  );
}
