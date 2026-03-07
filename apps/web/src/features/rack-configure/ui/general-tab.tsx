import type { Rack } from '@wos/domain';
import { useUpdateRackGeneral } from '@/entities/layout-version/model/editor-selectors';

export function GeneralTab({ rack }: { rack: Rack }) {
  const updateRackGeneral = useUpdateRackGeneral();

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">General</h2>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-slate-700">
            Display Code
            <input className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={rack.displayCode} onChange={(event) => updateRackGeneral(rack.id, { displayCode: event.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-slate-700">
              Kind
              <select className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={rack.kind} onChange={(event) => updateRackGeneral(rack.id, { kind: event.target.value as Rack['kind'] })}>
                <option value="single">single</option>
                <option value="paired">paired</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Axis
              <select className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={rack.axis} onChange={(event) => updateRackGeneral(rack.id, { axis: event.target.value as Rack['axis'] })}>
                <option value="NS">NS</option>
                <option value="WE">WE</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-slate-700">
              Total Length
              <input type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={rack.totalLength} onChange={(event) => updateRackGeneral(rack.id, { totalLength: Number(event.target.value) || 0 })} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Depth
              <input type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={rack.depth} onChange={(event) => updateRackGeneral(rack.id, { depth: Number(event.target.value) || 0 })} />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 text-sm text-slate-700 shadow-sm">
        Canvas controls placement, movement, and 90 degree rotation only. Structural edits stay in the inspector.
      </div>
    </section>
  );
}
