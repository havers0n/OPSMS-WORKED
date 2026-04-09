import type { FloorWorkspace } from '@wos/domain';
import { AlertCircle } from 'lucide-react';
import { useActiveTask } from '@/entities/layout-version/model/editor-selectors';
import { RackCreationWizard } from '@/features/rack-create/ui/rack-creation-wizard';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';

export function TaskSurface({ workspace }: { workspace: FloorWorkspace | null }) {
  const activeTask = useActiveTask();
  const layoutDraft = useWorkspaceLayout(workspace);

  const rack =
    activeTask?.type === 'rack_creation' && layoutDraft
      ? (layoutDraft.racks[activeTask.rackId] ?? null)
      : null;

  if (!activeTask || !rack) {
    return (
      <aside
        data-testid="task-surface"
        className="flex h-full w-full flex-col bg-white"
      >
        <div className="border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Task
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300" />
          <div>
            <p className="text-sm font-medium text-slate-700">Task context unavailable</p>
            <p className="mt-1 text-xs text-slate-400">
              The active task is still open, but its rack data is not ready yet.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div data-testid="task-surface" className="h-full">
      <RackCreationWizard rack={rack} />
    </div>
  );
}
