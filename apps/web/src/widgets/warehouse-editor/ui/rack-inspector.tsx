import { generatePreviewCells, validateLayoutDraft } from '@wos/domain';
import type { FloorWorkspace, LayoutValidationIssue, Rack, RackFace } from '@wos/domain';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { FaceBEmptyState } from '@/features/face-b-configure-mode/ui/face-b-empty-state';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import {
  useApplyFacePreset,
  useDraftDirtyState,
  useIsLayoutEditable,
  useObjectWorkContext,
  useResetFaceB,
  useSetObjectWorkContext,
  useSelectedRackId,
  useSetFaceBMode,
  useUpdateFaceConfig,
  useUpdateRackGeneral,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';

// ─── types ───────────────────────────────────────────────────────────────────

type AccordionSection = 'faceA' | 'faceB' | 'address';

// ─── helpers ─────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function validationSummary(issues: LayoutValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { errors, warnings, hasIssues: issues.length > 0 };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function AccordionHeader({
  title,
  subtitle,
  isOpen,
  onToggle,
  badge
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
    >
      {isOpen ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</div>}
      </div>
      {badge}
    </button>
  );
}

function ValidationStrip({ issues }: { issues: LayoutValidationIssue[] }) {
  const { errors, warnings } = validationSummary(issues);
  if (!errors.length && !warnings.length) return null;

  return (
    <div
      className={cn(
        'border-b px-5 py-2.5 text-xs',
        errors.length > 0
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      )}
    >
      {errors.length > 0 && (
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          <div>
            <span className="font-semibold text-red-700">{errors.length} error{errors.length > 1 ? 's' : ''}:</span>{' '}
            <span className="text-red-600">{errors[0].message}</span>
            {errors.length > 1 && (
              <span className="text-red-500"> +{errors.length - 1} more</span>
            )}
          </div>
        </div>
      )}
      {!errors.length && warnings.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold text-amber-700">{warnings.length} warning{warnings.length > 1 ? 's' : ''}:</span>{' '}
            <span className="text-amber-600">{warnings[0].message}</span>
            {warnings.length > 1 && (
              <span className="text-amber-500"> +{warnings.length - 1} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function faceSummaryText(face: RackFace): string {
  if (face.isMirrored) return 'Mirrored from Face A';
  if (face.sections.length === 0) return 'Not configured';
  const cells = face.sections.reduce((sum, s) => sum + s.levels.reduce((l, lv) => l + lv.slotCount, 0), 0);
  return `${face.sections.length} sec | ${face.sections[0]?.levels.length ?? 0} lvl | ${cells} cells`;
}

// ─── NumberingPanel ───────────────────────────────────────────────────────────
// Controls slot numbering direction (LTR / RTL).
// Section ordering always follows the same direction as slot numbering.

type NumberingPanelProps = {
  rackId: string;
  side: 'A' | 'B';
  slotNumberingDirection: 'ltr' | 'rtl';
  disabled?: boolean;
  onUpdate: (rackId: string, side: 'A' | 'B', patch: { slotNumberingDirection?: 'ltr' | 'rtl' }) => void;
};

function ToggleGroup<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-400',
            value === opt.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NumberingPanel({ rackId, side, slotNumberingDirection, disabled, onUpdate }: NumberingPanelProps) {
  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Numbering
      </div>
      <div className="mb-1.5 text-xs text-slate-600">
        Numbering direction
        <span className="ml-1.5 text-slate-400">- defines which rack edge starts slot 1 and section 1</span>
      </div>
      <ToggleGroup
        value={slotNumberingDirection}
        disabled={disabled}
        options={[
          {
            value: 'ltr',
            label: '1 -> N',
            title: 'Slot 1 (and section 1) at the left/near end of the rack'
          },
          {
            value: 'rtl',
            label: 'N -> 1',
            title: 'Slot 1 (and section 1) at the right/far end of the rack'
          },
        ]}
        onChange={(v) => onUpdate(rackId, side, { slotNumberingDirection: v })}
      />
    </div>
  );
}

function WorkContextSwitch({
  value,
  onChange
}: {
  value: 'geometry' | 'structure';
  onChange: (next: 'geometry' | 'structure') => void;
}) {
  return (
    <div
      data-testid="rack-work-context-switch"
      className="mt-4 flex rounded-xl border border-[var(--border-muted)] bg-white p-1 shadow-sm"
    >
      {([
        { value: 'geometry', label: 'Geometry' },
        { value: 'structure', label: 'Structure' }
      ] as const).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            value === option.value
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StructureIdentityPanel({
  rack,
  readOnly
}: {
  rack: Rack;
  readOnly: boolean;
}) {
  const updateRackGeneral = useUpdateRackGeneral();

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Rack Identity
      </div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm text-slate-700">
          Display Code
          <input
            disabled={readOnly}
            className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            value={rack.displayCode}
            onChange={(event) => updateRackGeneral(rack.id, { displayCode: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Kind
          <select
            disabled={readOnly}
            className="rounded-xl border border-[var(--border-muted)] bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            value={rack.kind}
            onChange={(event) =>
              updateRackGeneral(rack.id, { kind: event.target.value as typeof rack.kind })
            }
          >
            <option value="single">single</option>
            <option value="paired">paired</option>
          </select>
        </label>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

/**
 * RackInspector — structural inspector for a single selected rack.
 *
 * Rendered only by InspectorRouter when:
 *   - viewMode === 'layout' AND a rack is selected in the inspector surface.
 *   - viewMode === 'view' AND a rack is selected in read-only scope.
 *
 * Task routing is handled by TaskSurface. This component never renders task flow.
 */
export function RackInspector({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const [openSections, setOpenSections] = useState<Set<AccordionSection>>(new Set(['faceA']));

  const layoutDraft = useWorkspaceLayout(workspace);
  const viewMode = useViewMode();
  const isLayoutEditable = useIsLayoutEditable();
  const isDraftDirty = useDraftDirtyState();
  const selectedRackId = useSelectedRackId();
  const objectWorkContext = useObjectWorkContext();
  const setObjectWorkContext = useSetObjectWorkContext();

  const setFaceBMode = useSetFaceBMode();
  const applyFacePreset = useApplyFacePreset();
  const resetFaceB = useResetFaceB();
  const updateFaceConfig = useUpdateFaceConfig();

  const persistedDraftValidation = useCachedLayoutValidation(layoutDraft?.layoutVersionId ?? null);

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const faceA = rack?.faces.find((f) => f.side === 'A') ?? null;
  const faceB = rack?.faces.find((f) => f.side === 'B') ?? null;

  const rackCells = useMemo(() => {
    if (!layoutDraft || !rack) return [];
    return generatePreviewCells({
      ...layoutDraft,
      rackIds: [rack.id],
      racks: { [rack.id]: rack }
    });
  }, [layoutDraft, rack]);

  const clientPrecheck = useMemo(
    () => (layoutDraft ? validateLayoutDraft(layoutDraft) : { isValid: false, issues: [] }),
    [layoutDraft]
  );
  const activeValidationSummary =
    !isDraftDirty && persistedDraftValidation.data ? persistedDraftValidation.data : clientPrecheck;
  const rackIssues = useMemo(
    () =>
      activeValidationSummary.issues.filter(
        (issue) =>
          !issue.entityId ||
          issue.entityId === rack?.id ||
          rack?.faces.some((f) => f.id === issue.entityId)
      ),
    [activeValidationSummary.issues, rack]
  );

  const previewAddresses = rackCells.slice(0, 6).map((cell) => cell.address.raw);
  const showWorkContextSwitch = viewMode === 'layout';

  // InspectorRouter guarantees this component is only rendered when a rack is
  // selected and is not in creation mode. This guard is a defensive fallback.
  if (!rack) return null;

  // ─── accordion helpers ───────────────────────────────────────────────────────

  const toggleSection = (id: AccordionSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isOpen = (id: AccordionSection) => openSections.has(id);

  // ─── derived face state (from store, not local state) ───────────────────────

  const faceBConfigured = !!faceB && (faceB.isMirrored || faceB.sections.length > 0);
  const isMirrored = !!faceB && faceB.isMirrored;

  const handleFaceBMode = (mode: 'mirror' | 'copy' | 'scratch') => {
    setFaceBMode(rack.id, mode);
    setOpenSections((prev) => new Set([...prev, 'faceB']));
  };

  const structureContent = (
    <>
      <div className="px-5 py-5">
        <StructureIdentityPanel rack={rack} readOnly={!isLayoutEditable} />
      </div>

      <div className="border-b border-[var(--border-muted)]">
        <AccordionHeader
          title="Face A"
          subtitle={faceA ? faceSummaryText(faceA) : undefined}
          isOpen={isOpen('faceA')}
          onToggle={() => toggleSection('faceA')}
          badge={
            rackIssues.some((i) => i.entityId === faceA?.id) ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            ) : undefined
          }
        />
        {isOpen('faceA') && faceA && (
          <div className="flex flex-col gap-4 px-5 pb-5">
            <NumberingPanel
              rackId={rack.id}
              side="A"
              slotNumberingDirection={faceA.slotNumberingDirection}
              disabled={!isLayoutEditable}
              onUpdate={updateFaceConfig}
            />
            <SectionPresetForm
              rackId={rack.id}
              side="A"
              totalLength={faceA.faceLength ?? rack.totalLength}
              initialSectionCount={faceA.sections.length || 3}
              initialLevelCount={faceA.sections[0]?.levels.length || 4}
              initialSlotCount={faceA.sections[0]?.levels[0]?.slotCount || 3}
              readOnly={!isLayoutEditable}
              onApply={applyFacePreset}
            />
            {faceA.sections.length > 0 && <FrontElevationPreview face={faceA} side="A" />}
            <FaceTab title="Face A" rackId={rack.id} face={faceA} readOnly={!isLayoutEditable} />
          </div>
        )}
      </div>

      <div className="border-b border-[var(--border-muted)]">
        <AccordionHeader
          title="Face B"
          subtitle={
            !faceBConfigured
              ? 'Not configured - single-face rack'
              : isMirrored
                ? 'Mirrored from Face A'
                : faceSummaryText(faceB)
          }
          isOpen={isOpen('faceB')}
          onToggle={() => toggleSection('faceB')}
          badge={
            isMirrored ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Mirror
              </span>
            ) : !faceBConfigured ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Single
              </span>
            ) : undefined
          }
        />
        {isOpen('faceB') && (
          <div className="px-5 pb-5">
            {faceBConfigured && (
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {isMirrored
                    ? 'Face B mirrors Face A automatically.'
                    : 'Face B is independently configured.'}
                </div>
                <button
                  type="button"
                  disabled={!isLayoutEditable}
                  onClick={() => resetFaceB(rack.id)}
                  className="text-xs font-medium text-red-500 underline-offset-2 hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                  title="Reset Face B to unconfigured (converts rack back to single)"
                >
                  Remove Face B
                </button>
              </div>
            )}

            {!faceBConfigured ? (
              <FaceBEmptyState selectedMode={null} onSelectMode={isLayoutEditable ? handleFaceBMode : () => {}} />
            ) : isMirrored ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Face B is a mirror of Face A. It will use reversed numbering direction automatically.
                </div>
                {faceA && faceA.sections.length > 0 && (
                  <FrontElevationPreview face={faceA} side="B" />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <NumberingPanel
                  rackId={rack.id}
                  side="B"
                  slotNumberingDirection={faceB.slotNumberingDirection}
                  disabled={!isLayoutEditable}
                  onUpdate={updateFaceConfig}
                />
                <SectionPresetForm
                  rackId={rack.id}
                  side="B"
                  totalLength={faceB.faceLength ?? rack.totalLength}
                  initialSectionCount={faceB.sections.length || 3}
                  initialLevelCount={faceB.sections[0]?.levels.length || 4}
                  initialSlotCount={faceB.sections[0]?.levels[0]?.slotCount || 3}
                  readOnly={!isLayoutEditable}
                  onApply={applyFacePreset}
                />
                {faceB.sections.length > 0 && (
                  <FrontElevationPreview face={faceB} side="B" />
                )}
                <FaceTab title="Face B" rackId={rack.id} face={faceB} readOnly={!isLayoutEditable} />
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <AccordionHeader
          title="Address Preview"
          subtitle={previewAddresses.length > 0 ? previewAddresses[0] + ' ...' : 'No addresses generated'}
          isOpen={isOpen('address')}
          onToggle={() => toggleSection('address')}
        />
        {isOpen('address') && (
          <div className="px-5 pb-5">
            {previewAddresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-muted)] px-4 py-4 text-center text-sm text-slate-400">
                Configure sections to see generated addresses.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {previewAddresses.map((addr) => (
                  <div
                    key={addr}
                    className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700"
                  >
                    {addr}
                  </div>
                ))}
                {rackCells.length > previewAddresses.length && (
                  <div className="text-center text-xs text-slate-400">
                    +{rackCells.length - previewAddresses.length} more addresses
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">

      {/* ── Sticky header ── */}
      <div className="shrink-0 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)]">
        {/* top row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Inspector</div>
          <button
            type="button"
            onClick={onClose}
            title="Close inspector"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* title */}
        <div className="px-5 pt-2 pb-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-slate-900">Rack {rack.displayCode}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {rack.kind === 'paired' ? 'Paired' : 'Single'} | {rack.totalLength.toFixed(1)} m x {rack.depth.toFixed(1)} m | {rack.rotationDeg} deg
            </div>
            {showWorkContextSwitch && (
              <WorkContextSwitch value={objectWorkContext} onChange={setObjectWorkContext} />
            )}
          </div>
        </div>
      </div>

      {/* ── Validation strip (only when issues exist) ── */}
      <ValidationStrip issues={rackIssues} />

      {/* ── Scrollable accordion body ── */}
      <div className="flex-1 overflow-y-auto">
        {showWorkContextSwitch ? (
          objectWorkContext === 'geometry' ? (
            <div className="px-5 py-5">
              <GeneralTab rack={rack} readOnly={!isLayoutEditable} />
            </div>
          ) : (
            structureContent
          )
        ) : (
          <>
            <div className="px-5 py-5">
              <GeneralTab rack={rack} readOnly={!isLayoutEditable} />
            </div>
            {structureContent}
          </>
        )}
      </div>
    </aside>
  );
}
