import type { RackFace } from '@wos/domain';
import { useAddLevel, useAddSection, useUpdateFaceConfig, useUpdateSectionLength } from '@/widgets/warehouse-editor/model/editor-selectors';

export function FaceTab({ title, rackId, face }: { title: string; rackId: string; face: RackFace }) {
  const updateFaceConfig = useUpdateFaceConfig();
  const updateSectionLength = useUpdateSectionLength();
  const addSection = useAddSection();
  const addLevel = useAddLevel();

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm text-slate-700">
            Anchor
            <select className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={face.anchor} onChange={(event) => updateFaceConfig(rackId, face.side, { anchor: event.target.value as RackFace['anchor'] })}>
              <option value="start">start</option>
              <option value="end">end</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            Numbering
            <select className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm" value={face.slotNumberingDirection} onChange={(event) => updateFaceConfig(rackId, face.side, { slotNumberingDirection: event.target.value as RackFace['slotNumberingDirection'] })}>
              <option value="ltr">ltr</option>
              <option value="rtl">rtl</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Sections</h3>
        <button type="button" onClick={() => addSection(rackId, face.side)} className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
          Add Section
        </button>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--border-muted)] bg-white shadow-sm">
        <div className="grid grid-cols-[80px_1fr_1fr_120px] gap-3 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span>Section</span>
          <span>Length</span>
          <span>Levels</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-[var(--border-muted)]">
          {face.sections.map((section) => (
            <div key={section.id} className="grid grid-cols-[80px_1fr_1fr_120px] gap-3 px-4 py-3 text-sm text-slate-700">
              <span className="self-center font-mono">{String(section.ordinal).padStart(2, '0')}</span>
              <input type="number" step="0.1" className="rounded-xl border border-[var(--border-muted)] px-3 py-2 shadow-sm" value={section.length} onChange={(event) => updateSectionLength(rackId, face.side, section.id, Number(event.target.value) || 0)} />
              <span className="self-center">{section.levels.length}</span>
              <button type="button" onClick={() => addLevel(rackId, face.side, section.id)} className="rounded-xl border border-[var(--border-muted)] px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
                Add Level
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
