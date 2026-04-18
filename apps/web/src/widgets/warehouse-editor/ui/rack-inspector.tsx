import { generatePreviewCells, resolveRackFaceRelationshipMode, validateLayoutDraft } from '@wos/domain';
import type { FloorWorkspace, LayoutValidationIssue, Rack, RackFace } from '@wos/domain';
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import {
  useDeleteRack,
  useDraftDirtyState,
  useDuplicateRack,
  useIsLayoutEditable,
  useObjectWorkContext,
  useRotateRack,
  useSelectedRackId,
  useSetObjectWorkContext,
  useUpdateRackGeneral,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { AddressingTask } from './rack-inspector/addressing-task';
import { GeometryTask } from './rack-inspector/geometry-task';
import { InspectorTaskNav } from './rack-inspector/inspector-task-nav';
import { StructureTask } from './rack-inspector/structure-task';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function InspectorSummaryBar({
  rack,
  faceA,
  faceB,
  rackCells,
  issues
}: {
  rack: Rack;
  faceA: RackFace | null;
  faceB: RackFace | null;
  rackCells: Array<{ address: { raw: string } }>;
  issues: LayoutValidationIssue[];
}) {
  const [isOpen, setIsOpen] = useState(true);

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const faceBConfigured = !!faceB && faceB.enabled;
  const facesSummary =
    rack.kind !== 'paired' || !faceBConfigured
      ? 'Single'
      : faceBRelationshipMode === 'mirrored'
        ? 'Paired / Mirrored'
        : 'Paired / Independent';

  const totalLevels = Array.from(
    new Set(
      [faceA, faceB]
        .filter((f): f is RackFace => !!f)
        .flatMap((f) => f.sections.flatMap((s) => s.levels.map((level) => level.ordinal)))
    )
  ).length;

  const { errors, warnings } = validationSummary(issues);

  const comparableDefaultRoleState = useMemo(() => {
    if (!faceA || !faceB || !faceB.enabled) return null;
    if (resolveRackFaceRelationshipMode(faceB) === 'mirrored') return null;

    const ordinalsA = new Set(faceA.sections.flatMap((section) => section.levels.map((level) => level.ordinal)));
    const ordinalsB = new Set(faceB.sections.flatMap((section) => section.levels.map((level) => level.ordinal)));
    const sharedOrdinals = [...ordinalsA].filter((ordinal) => ordinalsB.has(ordinal));
    if (sharedOrdinals.length === 0) return null;

    const resolveLevelRole = (face: RackFace, ordinal: number) => {
      const sampleLevel = face.sections
        .flatMap((section) => section.levels)
        .find((level) => level.ordinal === ordinal);
      return sampleLevel?.structuralDefaultRole ?? 'none';
    };

    const hasMixedRoles = sharedOrdinals.some(
      (ordinal) => resolveLevelRole(faceA, ordinal) !== resolveLevelRole(faceB, ordinal)
    );
    return hasMixedRoles ? 'Mixed' : 'Aligned';
  }, [faceA, faceB]);

  if (!isOpen) {
    return (
      <div
        data-testid="rack-inspector-summary-collapsed"
        className="flex w-7 shrink-0 flex-col border-r border-[var(--border-muted)] bg-[var(--surface-secondary)]"
      >
        <button
          type="button"
          title="Expand summary"
          onClick={() => setIsOpen(true)}
          className="flex flex-1 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="rack-inspector-summary"
      className="flex w-44 shrink-0 flex-col border-r border-[var(--border-muted)] bg-[var(--surface-secondary)]"
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Summary
        </div>
        <button
          type="button"
          title="Collapse summary"
          onClick={() => setIsOpen(false)}
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3 pt-2 text-[11px]">
        <div data-testid="rack-inspector-summary-faces" className="flex items-center justify-between gap-2 text-slate-600">
          <span>Faces</span>
          <span className="font-semibold text-slate-800">{facesSummary}</span>
        </div>
        <div data-testid="rack-inspector-summary-cells" className="flex items-center justify-between gap-2 text-slate-600">
          <span>Cells</span>
          <span className="font-semibold text-slate-800">{rackCells.length}</span>
        </div>
        <div data-testid="rack-inspector-summary-levels" className="flex items-center justify-between gap-2 text-slate-600">
          <span>Levels</span>
          <span className="font-semibold text-slate-800">{totalLevels}</span>
        </div>
        <div data-testid="rack-inspector-summary-validation" className="rounded-md border border-[var(--border-muted)] bg-white px-2 py-1.5 text-slate-600">
          <div>
            Validation:{' '}
            <span className="font-semibold text-slate-800">
              {errors.length} errors, {warnings.length} warnings
            </span>
          </div>
        </div>
        {comparableDefaultRoleState && (
          <div
            data-testid="rack-inspector-summary-default-roles"
            className="flex items-center justify-between gap-2 text-slate-600"
          >
            <span>Default roles</span>
            <span className="font-semibold text-slate-800">{comparableDefaultRoleState}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function validationSummary(issues: LayoutValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { errors, warnings, hasIssues: issues.length > 0 };
}

function RackHeaderDisplayCode({ rack, editable }: { rack: Rack; editable: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();
  const [isEditingDisplayCode, setIsEditingDisplayCode] = useState(false);
  const [displayCodeDraft, setDisplayCodeDraft] = useState(rack.displayCode);
  const displayCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayCodeDraft(rack.displayCode);
    setIsEditingDisplayCode(false);
  }, [rack.id, rack.displayCode]);

  useEffect(() => {
    if (!isEditingDisplayCode) return;
    displayCodeInputRef.current?.focus();
    displayCodeInputRef.current?.select();
  }, [isEditingDisplayCode]);

  const commitDisplayCodeEdit = () => {
    if (displayCodeDraft !== rack.displayCode) {
      updateRackGeneral(rack.id, { displayCode: displayCodeDraft });
    }
    setIsEditingDisplayCode(false);
  };

  const cancelDisplayCodeEdit = () => {
    setDisplayCodeDraft(rack.displayCode);
    setIsEditingDisplayCode(false);
  };

  return (
    <div className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
      <span>Rack</span>
      {editable ? (
        isEditingDisplayCode ? (
          <input
            ref={displayCodeInputRef}
            data-testid="rack-inspector-header-display-code-input"
            value={displayCodeDraft}
            onChange={(event) => setDisplayCodeDraft(event.target.value)}
            onBlur={commitDisplayCodeEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDisplayCodeEdit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelDisplayCodeEdit();
              }
            }}
            className="h-8 w-16 rounded-md border border-[var(--border-muted)] bg-white px-2 py-1 text-base font-semibold text-slate-900 shadow-sm outline-none focus:border-slate-400"
          />
        ) : (
          <button
            type="button"
            data-testid="rack-inspector-header-display-code-button"
            onClick={() => setIsEditingDisplayCode(true)}
            className="rounded-md border border-transparent px-2 py-1 text-base font-semibold text-slate-900 transition-colors hover:border-[var(--border-muted)] hover:bg-white"
          >
            {rack.displayCode}
          </button>
        )
      ) : (
        <span data-testid="rack-inspector-header-display-code-readonly">{rack.displayCode}</span>
      )}
    </div>
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
            <span className="font-semibold text-red-700">
              {errors.length} error{errors.length > 1 ? 's' : ''}:
            </span>{' '}
            <span className="text-red-600">{errors[0].message}</span>
            {errors.length > 1 && <span className="text-red-500"> +{errors.length - 1} more</span>}
          </div>
        </div>
      )}
      {!errors.length && warnings.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold text-amber-700">
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}:
            </span>{' '}
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

function RackQuickActions({ rack }: { rack: Rack }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const rotateRack = useRotateRack();
  const duplicateRack = useDuplicateRack();
  const deleteRack = useDeleteRack();

  useEffect(() => {
    setConfirmingDelete(false);
  }, [rack.id]);

  if (!confirmingDelete) {
    return (
      <div data-testid="rack-inspector-quick-actions" className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          data-testid="rack-inspector-action-rotate"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          onClick={() => rotateRack(rack.id)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Rotate
        </button>
        <button
          type="button"
          data-testid="rack-inspector-action-duplicate"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          onClick={() => duplicateRack(rack.id)}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </button>
        <button
          type="button"
          data-testid="rack-inspector-action-delete"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="rack-inspector-delete-confirm"
      className="mt-2 grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2"
    >
      <div className="self-center px-1 text-[11px] font-medium text-red-600">Delete this rack?</div>
      <div className="flex gap-1.5">
        <button
          type="button"
          data-testid="rack-inspector-delete-cancel"
          onClick={() => setConfirmingDelete(false)}
          className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="rack-inspector-delete-confirm-button"
          onClick={() => {
            deleteRack(rack.id);
            setConfirmingDelete(false);
          }}
          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * RackInspector — structural inspector for a single selected rack.
 *
 * Rendered only by InspectorRouter when:
 *   - viewMode === 'layout' AND a rack is selected in the inspector surface.
 *   - viewMode === 'view'/'storage' AND a rack is selected in read-only scope.
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
  const layoutDraft = useWorkspaceLayout(workspace);
  const viewMode = useViewMode();
  const isLayoutEditable = useIsLayoutEditable();
  const isDraftDirty = useDraftDirtyState();
  const selectedRackId = useSelectedRackId();
  const objectWorkContext = useObjectWorkContext();
  const setObjectWorkContext = useSetObjectWorkContext();

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

  const showTaskNav = viewMode === 'layout';

  // InspectorRouter guarantees this component is only rendered when a rack is
  // selected and is not in creation mode. This guard is a defensive fallback.
  if (!rack) return null;

  const renderTaskBody = () => {
    if (!showTaskNav) {
      // Storage/view: no task nav; stack geometry + structure (read-only by the
      // isLayoutEditable flag) so rack context is still fully inspectable.
      return (
        <>
          <GeometryTask rack={rack} readOnly={!isLayoutEditable} />
          <StructureTask
            rack={rack}
            faceA={faceA}
            faceB={faceB}
            readOnly={!isLayoutEditable}
          />
        </>
      );
    }

    switch (objectWorkContext) {
      case 'geometry':
        return <GeometryTask rack={rack} readOnly={!isLayoutEditable} />;
      case 'structure':
        return (
          <StructureTask
            rack={rack}
            faceA={faceA}
            faceB={faceB}
            readOnly={!isLayoutEditable}
          />
        );
      case 'addressing':
        return (
          <AddressingTask
            rack={rack}
            faceA={faceA}
            faceB={faceB}
            rackCells={rackCells}
            readOnly={!isLayoutEditable}
          />
        );
      case 'face-mode':
        // face-mode tab removed from nav; graceful fallback to structure
        return (
          <StructureTask
            rack={rack}
            faceA={faceA}
            faceB={faceB}
            readOnly={!isLayoutEditable}
          />
        );
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)]">
        <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-1">
          <div className="min-w-0">
            <RackHeaderDisplayCode rack={rack} editable={isLayoutEditable} />
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close inspector"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showTaskNav && (
          <div className="px-5 pt-1 pb-2">
            <InspectorTaskNav value={objectWorkContext} onChange={setObjectWorkContext} />
            {isLayoutEditable && <RackQuickActions rack={rack} />}
          </div>
        )}
      </div>

      <ValidationStrip issues={rackIssues} />

      <div className="flex flex-1 overflow-hidden">
        <InspectorSummaryBar
          rack={rack}
          faceA={faceA}
          faceB={faceB}
          rackCells={rackCells}
          issues={rackIssues}
        />
        <div className="flex-1 overflow-y-auto">{renderTaskBody()}</div>
      </div>
    </aside>
  );
}
