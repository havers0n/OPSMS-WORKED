import type { Rack } from '@wos/domain';
import { useUpdateRackGeneral } from '@/widgets/warehouse-editor/model/editor-selectors';

export function StructureIdentityPanel({ rack, readOnly }: { rack: Rack; readOnly: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Rack Identity
      </div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm text-slate-700">
          Display Code
          <input
            disabled={readOnly}
            className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            value={rack.displayCode}
            onChange={(event) => updateRackGeneral(rack.id, { displayCode: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Kind
          <select
            disabled={readOnly}
            className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            value={rack.kind}
            onChange={(event) =>
              updateRackGeneral(rack.id, { kind: event.target.value as typeof rack.kind })
            }
          >
            <option value="single">single</option>
            <option value="paired">paired</option>
          </select>
        </label>
      </div>
    </div>
  );
}
