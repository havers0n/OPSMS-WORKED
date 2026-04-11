type RackLevelPagerProps = {
  activeLevel: number;
  levelCount: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  testId?: string;
};

export function RackLevelPager({
  activeLevel,
  levelCount,
  onPrev,
  onNext,
  className = '',
  testId
}: RackLevelPagerProps) {
  if (levelCount <= 1) return null;

  const isPrevDisabled = activeLevel <= 0;
  const isNextDisabled = activeLevel >= levelCount - 1;

  return (
    <div
      data-testid={testId}
      className={`flex items-center justify-center gap-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-1.5 ${className}`.trim()}
    >
      <button
        type="button"
        aria-label="Previous level"
        disabled={isPrevDisabled}
        onClick={onPrev}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ←
      </button>
      <span className="min-w-[70px] text-center text-xs font-semibold text-slate-700">
        L {activeLevel + 1} / {levelCount}
      </span>
      <button
        type="button"
        aria-label="Next level"
        disabled={isNextDisabled}
        onClick={onNext}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        →
      </button>
    </div>
  );
}
