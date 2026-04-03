import type { FloorWorkspace } from '@wos/domain';
import { MousePointer2 } from 'lucide-react';

export function LayoutEmptyPanel({
  workspace: _workspace,
  onAddRack: _onAddRack
}: {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Inspector
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <MousePointer2 className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">No rack selected</p>
          <p className="mt-1 text-xs text-slate-400">
            Rack details appear here after selection.
          </p>
        </div>
      </div>
    </aside>
  );
}
