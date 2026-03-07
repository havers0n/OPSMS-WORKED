import type { LayoutValidationResult, Rack } from '@wos/domain';

export function SummaryTab({
  rack,
  previewAddresses,
  validationResult,
  generatedCellCount
}: {
  rack: Rack;
  previewAddresses: string[];
  validationResult: LayoutValidationResult;
  generatedCellCount: number;
}) {
  const totalSections = rack.faces.reduce((sum, face) => sum + face.sections.length, 0);
  const totalLevels = rack.faces.reduce((sum, face) => sum + face.sections.reduce((sectionSum, section) => sectionSum + section.levels.length, 0), 0);

  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Sections</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{totalSections}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Levels</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{totalLevels}</div>
        </div>
        <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Cells</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{generatedCellCount}</div>
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Address Preview</h2>
        <ul className="grid gap-2 text-sm text-slate-700">
          {previewAddresses.map((address) => (
            <li key={address} className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2 font-mono">{address}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Validation</h2>
        {validationResult.issues.length === 0 ? (
          <div className="text-sm text-emerald-700">No validation issues.</div>
        ) : (
          <ul className="grid gap-2 text-sm text-slate-700">
            {validationResult.issues.map((issue) => (
              <li key={`${issue.code}-${issue.entityId ?? 'global'}`} className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2">
                <span className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>{issue.severity.toUpperCase()}</span>{' '}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
