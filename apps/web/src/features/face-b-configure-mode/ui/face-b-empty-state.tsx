type FaceBMode = 'mirror' | 'copy' | 'scratch' | null;

const options: Array<{ id: Exclude<FaceBMode, null>; title: string; description: string }> = [
  { id: 'mirror', title: 'Mirror Face A', description: 'Linked structure. Face B updates with Face A changes.' },
  { id: 'copy', title: 'Copy Face A and Edit', description: 'Start from Face A, then customize independently.' },
  { id: 'scratch', title: 'Start from Scratch', description: 'Create a fully independent Face B structure.' }
];

export function FaceBEmptyState({
  selectedMode,
  onSelectMode
}: {
  selectedMode: FaceBMode;
  onSelectMode: (mode: Exclude<FaceBMode, null>) => void;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Face B</h2>
        <p className="text-sm text-slate-600">Choose the default strategy before opening structural editing for Face B.</p>
      </div>
      <div className="grid gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelectMode(option.id)}
            className={[
              'rounded-[18px] border px-4 py-4 text-left transition-colors shadow-sm',
              selectedMode === option.id ? 'border-cyan-500 bg-cyan-50' : 'border-[var(--border-muted)] bg-white hover:border-slate-300 hover:bg-slate-50'
            ].join(' ')}
          >
            <div className="text-sm font-semibold text-slate-900">{option.title}</div>
            <div className="mt-1 text-sm text-slate-600">{option.description}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
