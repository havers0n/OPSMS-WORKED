import type { RackFace } from '@wos/domain';
import { Trash2 } from 'lucide-react';
import {
  useAddSection,
  useDeleteSection,
  useUpdateFaceConfig,
  useUpdateLevelCount,
  useUpdateSectionLength,
  useUpdateSectionSlots
} from '@/entities/layout-version/model/editor-selectors';

export function FaceTab({ title, rackId, face, readOnly = false }: { title: string; rackId: string; face: RackFace; readOnly?: boolean }) {
  const updateFaceConfig = useUpdateFaceConfig();
  const updateSectionLength = useUpdateSectionLength();
  const updateSectionSlots = useUpdateSectionSlots();
  const updateLevelCount = useUpdateLevelCount();
  const addSection = useAddSection();
  const deleteSection = useDeleteSection();

  const totalFaceLength = face.sections.reduce((sum, s) => sum + s.length, 0);
  const totalCells = face.sections.reduce((sum, s) => sum + s.levels.reduce((lSum, l) => lSum + l.slotCount, 0), 0);

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</h2>
        <label className="grid gap-1 text-sm text-slate-700">
          Slot Numbering
          <select
            disabled={readOnly}
            className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm"
            value={face.slotNumberingDirection}
            onChange={(event) => updateFaceConfig(rackId, face.side, { slotNumberingDirection: event.target.value as RackFace['slotNumberingDirection'] })}
          >
            <option value="ltr">{"① → N"} (left to right)</option>
            <option value="rtl">{"N → ①"} (right to left)</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Sections ({face.sections.length})
        </h3>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => addSection(rackId, face.side)}
          className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          Add Section
        </button>
      </div>

      {face.sections.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-6 text-center text-sm text-slate-500">
          No sections yet. Add a section to start configuring this face.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[var(--border-muted)] bg-white shadow-sm">
          <div className="grid grid-cols-[52px_1fr_72px_80px_36px] gap-2 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            <span>#</span>
            <span>Length (m)</span>
            <span>Levels</span>
            <span>Slots/Lvl</span>
            <span />
          </div>
          <div className="divide-y divide-[var(--border-muted)]">
            {face.sections.map((section) => {
              const slotCount = section.levels[0]?.slotCount ?? 3;
              return (
                <div key={section.id} className="grid grid-cols-[52px_1fr_72px_80px_36px] items-center gap-2 px-4 py-2.5 text-sm text-slate-700">
                  <span className="font-mono text-slate-500">{String(section.ordinal).padStart(2, '0')}</span>
                  <input
                    disabled={readOnly}
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="rounded-xl border border-[var(--border-muted)] px-2.5 py-2 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    value={section.length}
                    onChange={(event) => updateSectionLength(rackId, face.side, section.id, Number(event.target.value) || 0)}
                  />
                  <input
                    disabled={readOnly}
                    type="number"
                    step="1"
                    min="1"
                    className="rounded-xl border border-[var(--border-muted)] px-2.5 py-2 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    value={section.levels.length}
                    onChange={(event) => updateLevelCount(rackId, face.side, section.id, Number(event.target.value) || 1)}
                  />
                  <input
                    disabled={readOnly}
                    type="number"
                    step="1"
                    min="1"
                    className="rounded-xl border border-[var(--border-muted)] px-2.5 py-2 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    value={slotCount}
                    onChange={(event) => updateSectionSlots(rackId, face.side, section.id, Number(event.target.value) || 1)}
                  />
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => deleteSection(rackId, face.side, section.id)}
                    className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Delete section"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {face.sections.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total Length</div>
            <div className="mt-1.5 text-lg font-semibold text-slate-900">{totalFaceLength.toFixed(1)} m</div>
          </div>
          <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sections</div>
            <div className="mt-1.5 text-lg font-semibold text-slate-900">{face.sections.length}</div>
          </div>
          <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Est. Cells</div>
            <div className="mt-1.5 text-lg font-semibold text-slate-900">{totalCells}</div>
          </div>
        </div>
      )}
    </section>
  );
}
