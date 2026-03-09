import { generateLayoutCells, validateLayoutDraft } from '@wos/domain';
import type { LayoutValidationIssue, Rack, RackFace } from '@wos/domain';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  RotateCcw,
  Trash2,
  X,
  XCircle,
  MousePointer2,
  PlusCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { FaceBEmptyState } from '@/features/face-b-configure-mode/ui/face-b-empty-state';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';
import { FrontElevationPreview } from '@/features/rack-configure/ui/front-elevation-preview';
import { SectionPresetForm } from '@/features/rack-configure/ui/section-preset-form';
import { RackCreationWizard } from '@/features/rack-create/ui/rack-creation-wizard';
import {
  useApplyFacePreset,
  useCreatingRackId,
  useDeleteRack,
  useDraftDirtyState,
  useDuplicateRack,
  useLayoutDraftState,
  useResetFaceB,
  useRotateRack,
  useSelectedRackId,
  useSetCreatingRackId,
  useSetFaceBMode,
  useSetSelectedRackId,
  useUpdateFaceConfig
} from '@/entities/layout-version/model/editor-selectors';

// ─── types ───────────────────────────────────────────────────────────────────

type AccordionSection = 'geometry' | 'faceA' | 'faceB' | 'address';

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

function StatusBadge({ rack, issues }: { rack: Rack; issues: LayoutValidationIssue[] }) {
  const { errors, warnings } = validationSummary(issues);
  if (errors.length > 0) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
        {errors.length} error{errors.length > 1 ? 's' : ''}
      </span>
    );
  }
  if (warnings.length > 0) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
        {warnings.length} warning{warnings.length > 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
      Valid
    </span>
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

function DeleteConfirm({
  rackCode,
  cellCount,
  onConfirm,
  onCancel
}: {
  rackCode: string;
  cellCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-red-200 bg-red-50 p-4">
      <div className="mb-2 text-sm font-semibold text-red-800">
        Delete Rack {rackCode}?
      </div>
      <div className="mb-3 text-xs text-red-600">
        This will remove the rack and its {cellCount} cell{cellCount !== 1 ? 's' : ''} from the layout. This action cannot be undone.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          Delete rack
        </button>
      </div>
    </div>
  );
}

function faceSummaryText(face: RackFace): string {
  if (face.isMirrored) return 'Mirrored from Face A';
  if (face.sections.length === 0) return 'Not configured';
  const cells = face.sections.reduce((sum, s) => sum + s.levels.reduce((l, lv) => l + lv.slotCount, 0), 0);
  return `${face.sections.length} sec · ${face.sections[0]?.levels.length ?? 0} lvl · ${cells} cells`;
}

// ─── NumberingPanel ───────────────────────────────────────────────────────────
// Controls slot numbering direction (LTR / RTL) and section anchor (start / end)
// Both affect the generated cell addresses for this face.

type NumberingPanelProps = {
  rackId: string;
  side: 'A' | 'B';
  slotNumberingDirection: 'ltr' | 'rtl';
  anchor: 'start' | 'end';
  onUpdate: (rackId: string, side: 'A' | 'B', patch: { slotNumberingDirection?: 'ltr' | 'rtl'; anchor?: 'start' | 'end' }) => void;
};

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
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

function NumberingPanel({ rackId, side, slotNumberingDirection, anchor, onUpdate }: NumberingPanelProps) {
  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Numbering
      </div>
      <div className="flex flex-col gap-3">
        {/* Slot direction */}
        <div>
          <div className="mb-1.5 text-xs text-slate-600">
            Slot direction
            <span className="ml-1.5 text-slate-400">— слот №1 начинается:</span>
          </div>
          <ToggleGroup
            value={slotNumberingDirection}
            options={[
              { value: 'ltr', label: '→ Слева (1…N)', title: 'Slot 1 is at the left end of the face' },
              { value: 'rtl', label: '← Справа (N…1)', title: 'Slot 1 is at the right end of the face' },
            ]}
            onChange={(v) => onUpdate(rackId, side, { slotNumberingDirection: v })}
          />
        </div>

        {/* Section anchor */}
        <div>
          <div className="mb-1.5 text-xs text-slate-600">
            Section anchor
            <span className="ml-1.5 text-slate-400">— секция №1 начинается:</span>
          </div>
          <ToggleGroup
            value={anchor}
            options={[
              { value: 'start', label: 'С начала', title: 'Section 1 starts at the left/near end of the rack' },
              { value: 'end',   label: 'С конца',  title: 'Section 1 starts at the right/far end of the rack' },
            ]}
            onChange={(v) => onUpdate(rackId, side, { anchor: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function RackInspector({ onClose, onAddRack }: { onClose: () => void; onAddRack: () => void }) {
  const [openSections, setOpenSections] = useState<Set<AccordionSection>>(new Set(['geometry', 'faceA']));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const selectedRackId = useSelectedRackId();
  const creatingRackId = useCreatingRackId();

  const setFaceBMode = useSetFaceBMode();
  const deleteRack = useDeleteRack();
  const duplicateRack = useDuplicateRack();
  const rotateRack = useRotateRack();
  const applyFacePreset = useApplyFacePreset();
  const resetFaceB = useResetFaceB();
  const setSelectedRackId = useSetSelectedRackId();
  const setCreatingRackId = useSetCreatingRackId();
  const updateFaceConfig = useUpdateFaceConfig();

  const cachedValidation = useCachedLayoutValidation(layoutDraft?.layoutVersionId ?? null);

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const faceA = rack?.faces.find((f) => f.side === 'A') ?? null;
  const faceB = rack?.faces.find((f) => f.side === 'B') ?? null;

  const rackCells = useMemo(() => {
    if (!layoutDraft || !rack) return [];
    return generateLayoutCells({
      ...layoutDraft,
      rackIds: [rack.id],
      racks: { [rack.id]: rack }
    });
  }, [layoutDraft, rack]);

  const previewValidationResult = useMemo(
    () => (layoutDraft ? validateLayoutDraft(layoutDraft) : { isValid: false, issues: [] }),
    [layoutDraft]
  );
  const validationResult = !isDraftDirty && cachedValidation.data ? cachedValidation.data : previewValidationResult;
  const rackIssues = useMemo(
    () =>
      validationResult.issues.filter(
        (issue) =>
          !issue.entityId ||
          issue.entityId === rack?.id ||
          rack?.faces.some((f) => f.id === issue.entityId)
      ),
    [validationResult.issues, rack]
  );

  const previewAddresses = rackCells.slice(0, 6).map((cell) => cell.address.raw);

  // ─── creation wizard ─────────────────────────────────────────────────────────
  // When the selected rack was just placed, delegate to the guided creation wizard
  if (rack && selectedRackId === creatingRackId) {
    return <RackCreationWizard rack={rack} />;
  }

  // ─── empty state ────────────────────────────────────────────────────────────

  // Show empty state only when no rack is selected at all
  if (!rack) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="border-b border-[var(--border-muted)] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Inspector</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <MousePointer2 className="h-8 w-8 text-slate-300" />
          <div>
            <p className="text-sm font-medium text-slate-700">No rack selected</p>
            <p className="mt-1 text-xs text-slate-400">Click a rack on the canvas to inspect it</p>
          </div>
          <button
            type="button"
            onClick={onAddRack}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
          >
            <PlusCircle className="h-4 w-4" />
            Add Rack
          </button>
        </div>
      </aside>
    );
  }

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

  const handleDeleteConfirm = () => {
    deleteRack(rack.id);
    setConfirmingDelete(false);
    setSelectedRackId(null);
    setCreatingRackId(null);
  };

  const handleDuplicate = () => {
    duplicateRack(rack.id);
  };

  const handleRotate = () => {
    rotateRack(rack.id);
  };

  // ─── stat bar values ─────────────────────────────────────────────────────────

  const totalSections = rack.faces.reduce((sum, f) => sum + f.sections.length, 0);

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

        {/* title + badge */}
        <div className="flex items-center justify-between gap-3 px-5 py-2">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-slate-900">Rack {rack.displayCode}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {rack.kind === 'paired' ? 'Paired' : 'Single'} · {rack.axis} · {rack.totalLength.toFixed(1)} m × {rack.depth.toFixed(1)} m · {rack.rotationDeg}°
            </div>
          </div>
          <StatusBadge rack={rack} issues={rackIssues} />
        </div>

        {/* stat chips */}
        <div className="grid grid-cols-4 gap-1.5 px-5 pb-3">
          {[
            { label: 'Kind', value: rack.kind === 'paired' ? 'Paired' : 'Single' },
            { label: 'Axis', value: rack.axis },
            { label: 'Sections', value: String(totalSections) },
            { label: 'Cells', value: String(rackCells.length) }
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--border-muted)] bg-white p-2 text-center shadow-sm">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        {/* quick actions */}
        <div className="flex items-center gap-2 border-t border-[var(--border-muted)] px-5 py-2.5">
          <button
            type="button"
            onClick={handleRotate}
            title="Rotate 90°"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-muted)] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Rotate
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            title="Duplicate rack"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-muted)] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <div className="flex-1" />
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="Delete rack"
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600">Sure?</span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Validation strip (only when issues exist) ── */}
      <ValidationStrip issues={rackIssues} />

      {/* ── Scrollable accordion body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Geometry accordion ── */}
        <div className="border-b border-[var(--border-muted)]">
          <AccordionHeader
            title="Geometry"
            subtitle={`${rack.totalLength.toFixed(1)} m × ${rack.depth.toFixed(1)} m · ${rack.kind}`}
            isOpen={isOpen('geometry')}
            onToggle={() => toggleSection('geometry')}
          />
          {isOpen('geometry') && (
            <div className="px-5 pb-5">
              <GeneralTab rack={rack} />
            </div>
          )}
        </div>

        {/* ── Face A accordion ── */}
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
              {/* Numbering direction */}
              <NumberingPanel
                rackId={rack.id}
                side="A"
                slotNumberingDirection={faceA.slotNumberingDirection}
                anchor={faceA.anchor}
                onUpdate={updateFaceConfig}
              />

              {/* Preset generator */}
              <SectionPresetForm
                rackId={rack.id}
                side="A"
                totalLength={faceA.faceLength ?? rack.totalLength}
                initialSectionCount={faceA.sections.length || 3}
                initialLevelCount={faceA.sections[0]?.levels.length || 4}
                initialSlotCount={faceA.sections[0]?.levels[0]?.slotCount || 3}
                onApply={applyFacePreset}
              />

              {/* Front elevation preview */}
              {faceA.sections.length > 0 && (
                <FrontElevationPreview face={faceA} side="A" />
              )}

              {/* Section table (always visible as override tool) */}
              <FaceTab title="Face A" rackId={rack.id} face={faceA} />
            </div>
          )}
        </div>

        {/* ── Face B accordion ── */}
        <div className="border-b border-[var(--border-muted)]">
          <AccordionHeader
            title="Face B"
            subtitle={
              !faceBConfigured
                ? 'Not configured — single-face rack'
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
              {/* Header row when Face B is already configured — allow resetting */}
              {faceBConfigured && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {isMirrored
                      ? 'Face B mirrors Face A automatically.'
                      : 'Face B is independently configured.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => resetFaceB(rack.id)}
                    className="text-xs font-medium text-red-500 underline-offset-2 hover:text-red-700 hover:underline"
                    title="Reset Face B to unconfigured (converts rack back to single)"
                  >
                    Remove Face B
                  </button>
                </div>
              )}

              {!faceBConfigured ? (
                <FaceBEmptyState selectedMode={null} onSelectMode={handleFaceBMode} />
              ) : isMirrored ? (
                /* Mirror mode: show read-only preview of mirrored layout */
                <div className="flex flex-col gap-4">
                  <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Face B is a mirror of Face A. It will use reversed numbering direction and end anchor automatically.
                  </div>
                  {faceA && faceA.sections.length > 0 && (
                    <FrontElevationPreview face={faceA} side="B" />
                  )}
                </div>
              ) : (
                /* Independent Face B configuration */
                <div className="flex flex-col gap-4">
                  <NumberingPanel
                    rackId={rack.id}
                    side="B"
                    slotNumberingDirection={faceB.slotNumberingDirection}
                    anchor={faceB.anchor}
                    onUpdate={updateFaceConfig}
                  />
                  <SectionPresetForm
                    rackId={rack.id}
                    side="B"
                    totalLength={faceB.faceLength ?? rack.totalLength}
                    initialSectionCount={faceB.sections.length || 3}
                    initialLevelCount={faceB.sections[0]?.levels.length || 4}
                    initialSlotCount={faceB.sections[0]?.levels[0]?.slotCount || 3}
                    onApply={applyFacePreset}
                  />
                  {faceB.sections.length > 0 && (
                    <FrontElevationPreview face={faceB} side="B" />
                  )}
                  <FaceTab title="Face B" rackId={rack.id} face={faceB} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Address Preview accordion ── */}
        <div>
          <AccordionHeader
            title="Address Preview"
            subtitle={previewAddresses.length > 0 ? previewAddresses[0] + ' …' : 'No addresses generated'}
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

      </div>
    </aside>
  );
}
