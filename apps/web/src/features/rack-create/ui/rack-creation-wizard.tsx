import { useState } from 'react';
import { resolveRackFaceRelationshipMode, type Rack, type RackFace } from '@wos/domain';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { FaceBEmptyState } from '@/features/face-b-configure-mode/ui/face-b-empty-state';
import { RotateCcw } from 'lucide-react';
import {
  useApplyFacePreset,
  useClearActiveTask,
  useDeleteRack,
  useRotateRack,
  useSetFaceBRelationship,
  useSetFaceLength,
  useSetSelectedRackId,
  useUpdateRackGeneral
} from '@/warehouse/state/rack-layout-actions';
import { formatRackAxis } from '@/shared/lib/rack-face-labels';

// ─── types ────────────────────────────────────────────────────────────────────

type WizardStep = 'geometry' | 'sections' | 'faceB' | 'done';

const STEPS: WizardStep[] = ['geometry', 'sections', 'faceB', 'done'];
const VISIBLE_STEPS: WizardStep[] = ['geometry', 'sections', 'faceB'];

const STEP_LABELS: Record<WizardStep, string> = {
  geometry: 'Geometry',
  sections: 'Sections',
  faceB: 'Face B',
  done: 'Done'
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function StepDot({
  step,
  current,
  done,
  onClick
}: {
  step: WizardStep;
  current: WizardStep;
  done: boolean;
  onClick?: () => void;
}) {
  const isActive = step === current;
  const isClickable = done && !isActive;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={[
        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
        isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default',
        done
          ? 'bg-emerald-500 text-white'
          : isActive
            ? 'bg-slate-900 text-white'
            : 'bg-slate-200 text-slate-500'
      ].join(' ')}
    >
      {done && !isActive ? <Check className="h-3.5 w-3.5" /> : STEPS.indexOf(step) + 1}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-slate-700">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function TogglePair<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            value === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

/**
 * Shown inside TaskSurface when a rack creation task is active.
 * Guides the user through geometry → sections → face B in a progressive sequence.
 * Completed step dots are clickable for free backward navigation.
 * The user can abandon the wizard at any time via "Cancel" (deletes the rack).
 */
export function RackCreationWizard({ rack }: { rack: Rack }) {
  const [step, setStep] = useState<WizardStep>('geometry');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  const updateRackGeneral = useUpdateRackGeneral();
  const applyFacePreset = useApplyFacePreset();
  const setFaceBRelationship = useSetFaceBRelationship();
  const setFaceLength = useSetFaceLength();
  const rotateRack = useRotateRack();
  const clearActiveTask = useClearActiveTask();
  const deleteRack = useDeleteRack();
  const setSelectedRackId = useSetSelectedRackId();

  const faceA = rack.faces.find((f) => f.side === 'A') as RackFace;
  const faceB = rack.faces.find((f) => f.side === 'B') as RackFace;
  const faceBRelationshipMode = resolveRackFaceRelationshipMode(faceB);

  // Effective lengths — per-face override takes priority over rack.totalLength
  const faceALength = faceA.faceLength ?? rack.totalLength;
  const faceBLength = faceB.faceLength ?? rack.totalLength;

  const completeStep = (s: WizardStep, next: WizardStep) => {
    setCompletedSteps((prev) => new Set([...prev, s]));
    setStep(next);
  };

  const goToStep = (s: WizardStep) => setStep(s);

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleCancel = () => {
    clearActiveTask();
    deleteRack(rack.id);
    setSelectedRackId(null);
  };

  const handleFinish = () => {
    clearActiveTask();
    // Inspector stays open on the now-configured rack in normal edit mode
  };

  return (
    <div className="flex h-full flex-col">
      {/* Wizard header */}
      <div className="shrink-0 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            New Rack — Setup Guide
          </div>
          <button
            type="button"
            onClick={handleCancel}
            title="Cancel and discard this rack"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>

        {/* Step indicator — completed dots are clickable for backward navigation */}
        <div className="flex items-center gap-2">
          {VISIBLE_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <StepDot
                step={s}
                current={step}
                done={completedSteps.has(s)}
                onClick={() => goToStep(s)}
              />
              <span
                onClick={completedSteps.has(s) && s !== step ? () => goToStep(s) : undefined}
                className={[
                  'text-xs font-medium',
                  s === step
                    ? 'text-slate-800'
                    : completedSteps.has(s)
                      ? 'cursor-pointer text-emerald-600 hover:text-emerald-700'
                      : 'text-slate-400'
                ].join(' ')}
              >
                {STEP_LABELS[s]}
              </span>
              {i < VISIBLE_STEPS.length - 1 && (
                <div className="h-px w-6 bg-slate-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Wizard body */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Step: Geometry ── */}
        {step === 'geometry' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Define rack geometry</h2>
              <p className="mt-1 text-xs text-slate-500">
                Set the rack's physical dimensions and orientation. You can refine these later.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <FieldRow label="Display Code">
                <input
                  className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                  value={rack.displayCode}
                  onChange={(e) => updateRackGeneral(rack.id, { displayCode: e.target.value })}
                />
              </FieldRow>

              <FieldRow label="Type">
                <TogglePair
                  value={rack.kind}
                  options={[
                    { value: 'single', label: 'Single-face' },
                    { value: 'paired', label: 'Paired (back-to-back)' }
                  ]}
                  onChange={(kind) => updateRackGeneral(rack.id, { kind })}
                />
              </FieldRow>

              {/* Orientation — rotate the rack 90° at a time, axis syncs automatically */}
              <FieldRow label="Orientation">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => rotateRack(rack.id)}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Rotate 90°
                  </button>
                  <span className="text-sm text-slate-500">
                    Current: <span className="font-semibold text-slate-800">{rack.rotationDeg}°</span>
                    <span className="ml-1.5 text-slate-400">({formatRackAxis(rack.axis)})</span>
                  </span>
                </div>
              </FieldRow>

              {/* Length — single: one field; paired: per-face fields */}
              {rack.kind === 'single' ? (
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Total Length (m)">
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                      value={rack.totalLength}
                      onChange={(e) => updateRackGeneral(rack.id, { totalLength: Number(e.target.value) || 1 })}
                    />
                  </FieldRow>
                  <FieldRow label="Depth (m)">
                    <input
                      type="number"
                      step="0.1"
                      min="0.3"
                      className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                      value={rack.depth}
                      onChange={(e) => updateRackGeneral(rack.id, { depth: Number(e.target.value) || 0.5 })}
                    />
                  </FieldRow>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Face A Length (m)">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                        value={faceALength}
                        onChange={(e) => setFaceLength(rack.id, 'A', Number(e.target.value) || 1)}
                      />
                    </FieldRow>
                    <FieldRow label="Face B Length (m)">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                        value={faceBLength}
                        onChange={(e) => setFaceLength(rack.id, 'B', Number(e.target.value) || 1)}
                      />
                    </FieldRow>
                  </div>
                  {Math.abs(faceALength - faceBLength) > 0.05 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Asymmetric — Face A ({faceALength.toFixed(1)} m) and Face B ({faceBLength.toFixed(1)} m) will show a boundary line on the canvas.
                    </div>
                  )}
                  <FieldRow label="Depth (m)">
                    <input
                      type="number"
                      step="0.1"
                      min="0.3"
                      className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 text-sm shadow-sm"
                      value={rack.depth}
                      onChange={(e) => updateRackGeneral(rack.id, { depth: Number(e.target.value) || 0.5 })}
                    />
                  </FieldRow>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => completeStep('geometry', 'sections')}
              disabled={!rack.displayCode || rack.totalLength <= 0 || rack.depth <= 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next: Configure sections
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step: Sections (Face A) ── */}
        {step === 'sections' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Generate Face A sections</h2>
              <p className="mt-1 text-xs text-slate-500">
                Choose how many sections, levels, and slots to generate. Sections will be equal width.
                You can fine-tune individual sections in the inspector after setup.
              </p>
            </div>

            <SectionPresetForm
              rackId={rack.id}
              side="A"
              totalLength={faceALength}
              existingSectionCount={faceA.sections.length}
              initialSectionCount={faceA.sections.length || 3}
              initialLevelCount={faceA.sections[0]?.levels.length || 4}
              initialSlotCount={faceA.sections[0]?.levels[0]?.slotCount || 3}
              onApply={applyFacePreset}
            />

            {faceA.sections.length > 0 && (
              <FrontElevationPreview face={faceA} side="A" />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => completeStep('sections', rack.kind === 'paired' ? 'faceB' : 'done')}
                disabled={faceA.sections.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {rack.kind === 'paired' ? 'Next: Configure Face B' : 'Finish setup'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Face B (only for paired racks) ── */}
        {step === 'faceB' && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Configure Face B</h2>
              <p className="mt-1 text-xs text-slate-500">
                This is a paired rack. Choose how Face B relates to Face A.
              </p>
            </div>

            <FaceBEmptyState
              selectedMode={faceBRelationshipMode === 'mirrored' ? 'mirror' : faceB.sections.length > 0 ? 'copy' : null}
              onSelectMode={(mode) =>
                mode === 'mirror'
                  ? setFaceBRelationship(rack.id, 'mirrored')
                  : setFaceBRelationship(rack.id, 'independent', { initFrom: mode })
              }
            />

            {faceBRelationshipMode === 'mirrored' && faceA.sections.length > 0 && (
              <FrontElevationPreview face={faceA} side="B" />
            )}
            {faceBRelationshipMode !== 'mirrored' && faceB.sections.length > 0 && (
              <>
                <SectionPresetForm
                  rackId={rack.id}
                  side="B"
                  totalLength={faceBLength}
                  existingSectionCount={faceB.sections.length}
                  initialSectionCount={faceB.sections.length}
                  initialLevelCount={faceB.sections[0]?.levels.length || 4}
                  initialSlotCount={faceB.sections[0]?.levels[0]?.slotCount || 3}
                  onApply={applyFacePreset}
                />
                <FrontElevationPreview face={faceB} side="B" />
              </>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => completeStep('faceB', 'done')}
                disabled={faceBRelationshipMode !== 'mirrored' && faceB.sections.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finish setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Rack {rack.displayCode} is ready</h2>
              <p className="mt-1 text-sm text-slate-500">
                You can now fine-tune individual sections, levels, and slots in the inspector.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Type', value: rack.kind === 'paired' ? 'Paired' : 'Single' },
                { label: 'Axis', value: formatRackAxis(rack.axis) },
                { label: 'Face A', value: `${faceALength.toFixed(1)} m` },
                { label: 'Sections A', value: String(faceA.sections.length) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
                  <div className="mt-0.5 font-semibold text-slate-800">{value}</div>
                </div>
              ))}
            </div>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-muted)] bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
              >
                Open in inspector
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
