import type { Rack } from '@wos/domain';
import { useUpdateRackGeneral } from '@/widgets/warehouse-editor/model/editor-selectors';

export function StructureIdentityPanel({ rack, readOnly }: { rack: Rack; readOnly: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Rack Identity
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-slate-600">
          Display Code
          <input
            disabled={readOnly}
            className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            value={rack.displayCode}
            onChange={(event) => updateRackGeneral(rack.id, { displayCode: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-600">
          Kind
          <select
            disabled={readOnly}
            className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
