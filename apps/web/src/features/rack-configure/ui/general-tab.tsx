import type { Rack } from '@wos/domain';
import { RotateCcw } from 'lucide-react';
import {
  useRotateRack,
  useUpdateRackGeneral,
  useUpdateRackPosition
} from '@/entities/layout-version/model/editor-selectors';

export function GeneralTab({ rack, readOnly = false }: { rack: Rack; readOnly?: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();
  const updateRackPosition = useUpdateRackPosition();
  const rotateRack = useRotateRack();

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Geometry</h2>
        <div className="grid gap-3">
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
          <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rotation</div>
                <div className="mt-1 text-sm text-slate-600">Rotate the rack body in 90 degree steps.</div>
              </div>
              <div className="rounded-lg bg-[var(--surface-secondary)] px-3 py-2 font-mono text-sm font-semibold text-slate-700">
                {rack.rotationDeg}°
              </div>
            </div>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => rotateRack(rack.id)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              <RotateCcw className="h-4 w-4" />
              Rotate 90°
            </button>
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
          : 'Geometry stays editable here in the inspector. Structural and addressing edits live in the Structure context.'}
      </div>
    </section>
  );
}
