type SlotNumberingDirection = 'ltr' | 'rtl';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function NumberingPanel({
  rackId,
  side,
  slotNumberingDirection,
  disabled,
  onUpdate
}: {
  rackId: string;
  side: 'A' | 'B';
  slotNumberingDirection: SlotNumberingDirection;
  disabled?: boolean;
  onUpdate: (
    rackId: string,
    side: 'A' | 'B',
    patch: { slotNumberingDirection?: SlotNumberingDirection }
  ) => void;
}) {
  const options: Array<{ value: SlotNumberingDirection; label: string; title: string }> = [
    {
      value: 'ltr',
      label: '1 -> N',
      title: 'Slot 1 (and section 1) at the left/near end of the rack'
    },
    {
      value: 'rtl',
      label: 'N -> 1',
      title: 'Slot 1 (and section 1) at the right/far end of the rack'
    }
  ];

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Numbering · Face {side}
      </div>
      <div className="mb-1.5 text-xs text-slate-600">
        Numbering direction
        <span className="ml-1.5 text-slate-400">
          - defines which rack edge starts slot 1 and section 1
        </span>
      </div>
      <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            title={opt.title}
            onClick={() => onUpdate(rackId, side, { slotNumberingDirection: opt.value })}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-400',
              slotNumberingDirection === opt.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
