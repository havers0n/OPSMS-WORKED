import { useState } from 'react';
import { Zap } from 'lucide-react';

interface SectionPresetFormProps {
  rackId: string;
  side: 'A' | 'B';
  totalLength: number;
  /** Current section count, used as initial value */
  initialSectionCount: number;
  /** Current level count (from first section), used as initial value */
  initialLevelCount: number;
  /** Current slot count (from first level of first section), used as initial value */
  initialSlotCount: number;
  onApply: (rackId: string, side: 'A' | 'B', sectionCount: number, levelCount: number, slotCount: number) => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-muted)] text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="h-8 w-12 rounded-lg border border-[var(--border-muted)] bg-white text-center text-sm font-semibold text-slate-800 shadow-sm"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-muted)] text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Generates equal-width sections for a face from three scalar parameters.
 * This replaces the tedious row-by-row section table for initial setup.
 * The raw section table is still available as an "override" mode.
 */
export function SectionPresetForm({
  rackId,
  side,
  totalLength,
  initialSectionCount,
  initialLevelCount,
  initialSlotCount,
  onApply
}: SectionPresetFormProps) {
  const [sectionCount, setSectionCount] = useState(Math.max(1, initialSectionCount));
  const [levelCount, setLevelCount] = useState(Math.max(1, initialLevelCount));
  const [slotCount, setSlotCount] = useState(Math.max(1, initialSlotCount));

  const sectionLength = totalLength > 0 ? totalLength / sectionCount : 0;
  const totalCells = sectionCount * levelCount * slotCount;

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Preset Generator
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Stepper label="Sections" value={sectionCount} min={1} max={20} onChange={setSectionCount} />
        <Stepper label="Levels" value={levelCount} min={1} max={20} onChange={setLevelCount} />
        <Stepper label="Slots / level" value={slotCount} min={1} max={30} onChange={setSlotCount} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          <span className="font-mono font-medium text-slate-700">{sectionLength.toFixed(2)} m</span>{' '}
          per section ·{' '}
          <span className="font-mono font-medium text-slate-700">{totalCells}</span>{' '}
          cells total
        </div>

        <button
          type="button"
          onClick={() => onApply(rackId, side, sectionCount, levelCount, slotCount)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 active:scale-95"
        >
          <Zap className="h-3.5 w-3.5" />
          Generate
        </button>
      </div>
    </div>
  );
}
