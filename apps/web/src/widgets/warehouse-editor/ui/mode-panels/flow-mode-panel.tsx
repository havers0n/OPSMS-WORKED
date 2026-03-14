import { Workflow } from 'lucide-react';

/**
 * Flow mode — explicit read-only scaffold.
 *
 * Flow will show operational task context: picking assignments, replenishment
 * queues, and process stages. It presupposes an operational task domain model
 * that does not yet exist in this repository.
 *
 * This panel is intentionally non-functional. Do not add operational logic
 * here until the task/assignment domain model is defined.
 */
export function FlowModePanel() {
  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--surface-primary)' }}
    >
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Flow
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Workflow className="h-8 w-8 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">Operational Flow</p>
          <p className="mt-1 text-xs text-slate-400">
            Picking assignments, replenishment queues, and process stage context.
          </p>
          <p className="mt-3 text-[11px] text-slate-300">
            Flow data is not yet available.
            <br />
            This mode requires an operational task model.
          </p>
        </div>
      </div>
    </aside>
  );
}
