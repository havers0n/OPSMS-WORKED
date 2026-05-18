import type { FloorWorkspace } from '@wos/domain';
import { Box, X } from 'lucide-react';
import {
  useEditorSelection
} from '@/warehouse/editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';

type RackViewInspectorProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
};

export function RackViewInspector({ workspace, onClose }: RackViewInspectorProps) {
  const selection = useEditorSelection();
  const layout = useWorkspaceLayout(workspace);
  const rackId = selection.type === 'rack' ? selection.rackIds[0] ?? null : null;
  const rack = rackId && layout ? layout.racks[rackId] ?? null : null;

  if (!rack) {
    return (
      <aside
        className="flex h-full w-full flex-col"
        style={{ background: 'var(--surface-primary)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            View
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          Select a rack to inspect.
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: 'var(--surface-primary)' }}
      data-testid="rack-view-inspector"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Box className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              View
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
              Rack {rack.displayCode}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Rack overview
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-slate-400">Type</div>
              <div className="mt-0.5 font-semibold capitalize text-slate-700">
                {rack.kind}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Axis</div>
              <div className="mt-0.5 font-semibold capitalize text-slate-700">
                {rack.axis}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
