import { useEffect, useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';

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
  /** Number of sections currently present on the face. When > 0, Generate requires confirmation. */
  existingSectionCount: number;
  readOnly?: boolean;
  onApply: (rackId: string, side: 'A' | 'B', sectionCount: number, levelCount: number, slotCount: number) => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  readOnly,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  readOnly?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={readOnly || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-muted)] text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <input
          disabled={readOnly}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="h-8 w-12 rounded-lg border border-[var(--border-muted)] bg-white text-center text-sm font-semibold text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={readOnly || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
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
 * When the target face already has sections, Generate arms an inline
 * confirmation before calling onApply — so the section list cannot be
 * silently overwritten.
 */
export function SectionPresetForm({
  rackId,
  side,
  totalLength,
  initialSectionCount,
  initialLevelCount,
  initialSlotCount,
  existingSectionCount,
  readOnly = false,
  onApply
}: SectionPresetFormProps) {
  const [sectionCount, setSectionCount] = useState(Math.max(1, initialSectionCount));
  const [levelCount, setLevelCount] = useState(Math.max(1, initialLevelCount));
  const [slotCount, setSlotCount] = useState(Math.max(1, initialSlotCount));
  const [pendingConfirm, setPendingConfirm] = useState(false);

  // If the face's real section count changes (e.g. another edit or a confirmed
  // apply landed), drop any armed confirmation so the form re-reflects truth.
  useEffect(() => {
    setPendingConfirm(false);
  }, [existingSectionCount]);

  const sectionLength = totalLength > 0 ? totalLength / sectionCount : 0;
  const totalCells = sectionCount * levelCount * slotCount;

  const updateSectionCount = (v: number) => {
    setSectionCount(v);
    setPendingConfirm(false);
  };
  const updateLevelCount = (v: number) => {
    setLevelCount(v);
    setPendingConfirm(false);
  };
  const updateSlotCount = (v: number) => {
    setSlotCount(v);
    setPendingConfirm(false);
  };

  const handleGenerate = () => {
    if (existingSectionCount > 0) {
      setPendingConfirm(true);
    } else {
      onApply(rackId, side, sectionCount, levelCount, slotCount);
    }
  };

  const handleConfirmReplace = () => {
    onApply(rackId, side, sectionCount, levelCount, slotCount);
    setPendingConfirm(false);
  };

  const handleCancelReplace = () => {
    setPendingConfirm(false);
  };

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Preset Generator
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Stepper label="Sections" value={sectionCount} min={1} max={20} readOnly={readOnly} onChange={updateSectionCount} />
        <Stepper label="Levels" value={levelCount} min={1} max={20} readOnly={readOnly} onChange={updateLevelCount} />
        <Stepper label="Slots / level" value={slotCount} min={1} max={30} readOnly={readOnly} onChange={updateSlotCount} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          <span className="font-mono font-medium text-slate-700">{sectionLength.toFixed(2)} m</span>{' '}
          per section ·{' '}
          <span className="font-mono font-medium text-slate-700">{totalCells}</span>{' '}
          cells total
        </div>

        {!pendingConfirm && (
          <button
            type="button"
            disabled={readOnly}
            data-testid="section-preset-generate"
            onClick={handleGenerate}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:active:scale-100"
          >
            <Zap className="h-3.5 w-3.5" />
            Generate
          </button>
        )}
      </div>

      {pendingConfirm && (
        <div
          data-testid="section-preset-confirm"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="flex-1 text-xs text-red-700">
              <div className="font-semibold">Replace existing structure?</div>
              <div className="mt-0.5 text-red-600">
                This will replace {existingSectionCount} existing section
                {existingSectionCount === 1 ? '' : 's'} on Face {side} with the preset above.
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              data-testid="section-preset-cancel"
              onClick={handleCancelReplace}
              className="rounded-lg border border-[var(--border-muted)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="section-preset-replace"
              onClick={handleConfirmReplace}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
            >
              Replace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
