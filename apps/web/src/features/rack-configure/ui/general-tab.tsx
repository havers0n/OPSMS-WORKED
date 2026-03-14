import type { Rack } from '@wos/domain';
import { useUpdateRackGeneral, useUpdateRackPosition } from '@/entities/layout-version/model/editor-selectors';

export function GeneralTab({ rack, readOnly = false }: { rack: Rack; readOnly?: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();
  const updateRackPosition = useUpdateRackPosition();

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">General</h2>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-slate-700">
            Display Code
            <input disabled={readOnly} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.displayCode} onChange={(event) => updateRackGeneral(rack.id, { displayCode: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            Kind
            <select disabled={readOnly} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.kind} onChange={(event) => updateRackGeneral(rack.id, { kind: event.target.value as Rack['kind'] })}>
              <option value="single">single</option>
              <option value="paired">paired</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-slate-700">
              Total Length
              <input disabled={readOnly} type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.totalLength} onChange={(event) => updateRackGeneral(rack.id, { totalLength: Number(event.target.value) || 0 })} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Depth
              <input disabled={readOnly} type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.depth} onChange={(event) => updateRackGeneral(rack.id, { depth: Number(event.target.value) || 0 })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-slate-700">
              Position X
              <input disabled={readOnly} type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.x.toFixed(2)} onChange={(event) => updateRackPosition(rack.id, Number(event.target.value) || 0, rack.y)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              Position Y
              <input disabled={readOnly} type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" value={rack.y.toFixed(2)} onChange={(event) => updateRackPosition(rack.id, rack.x, Number(event.target.value) || 0)} />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 text-sm text-slate-700 shadow-sm">
        {readOnly
          ? 'Published layouts are read-only here. Create a draft to edit geometry.'
          : 'Canvas controls placement, movement, and 90 degree rotation only. Structural edits stay in the inspector.'}
      </div>
    </section>
  );
}
