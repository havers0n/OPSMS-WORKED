import { generatePreviewCells, resolveRackFaceRelationshipMode, validateLayoutDraft } from '@wos/domain';
import type { FloorWorkspace, LayoutValidationIssue, Rack, RackFace } from '@wos/domain';
import { AlertTriangle, ChevronLeft, ChevronRight, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import {
  useDraftDirtyState,
  useIsLayoutEditable,
  useObjectWorkContext,
  useSelectedRackId,
  useSetObjectWorkContext,
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
  rackCells
}: {
  rack: Rack;
  faceA: RackFace | null;
  faceB: RackFace | null;
  rackCells: Array<{ address: { raw: string } }>;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const faceBMode = faceB
    ? resolveRackFaceRelationshipMode(faceB) === 'mirrored'
      ? 'Mirror'
      : 'Indep.'
    : 'Off';

  const totalLevels = Math.max(
    0,
    ...[faceA, faceB]
      .filter((f): f is RackFace => !!f)
      .flatMap((f) => f.sections)
      .map((s) => s.levels.length)
  );

  const slotDir = faceA?.slotNumberingDirection ?? 'ltr';

  if (!isOpen) {
    return (
      <div className="flex w-7 shrink-0 flex-col border-r border-[var(--border-muted)] bg-[var(--surface-secondary)]">
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
    <div className="flex w-40 shrink-0 flex-col border-r border-[var(--border-muted)] bg-[var(--surface-secondary)]">
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

      <div className="flex flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">{rackCells.length}</span> slots
          </div>
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">{totalLevels}</span> levels
          </div>
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">
              {rack.totalLength.toFixed(1)} × {rack.depth.toFixed(1)}
            </span>{' '}
            m
          </div>
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">{rack.rotationDeg}°</span> rotation
          </div>
          <div className="text-[11px] text-slate-600">
            Face B: <span className="font-semibold text-slate-800">{faceBMode}</span>
          </div>
          <div className="text-[11px] text-slate-600">
            {rack.kind === 'paired' ? 'Paired' : 'Single'}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Policies
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { color: 'bg-blue-500', label: 'Pick' },
              { color: 'bg-amber-500', label: 'Reserve' },
              { color: 'bg-slate-300', label: 'None' }
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                <div className="text-[11px] text-slate-600">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Face Config
          </div>
          <div className="flex flex-col gap-1">
            {(
              [
                { dir: 'ltr', arrow: '→', slots: '01 02 03', label: 'LTR' },
                { dir: 'rtl', arrow: '←', slots: '03 02 01', label: 'RTL' }
              ] as const
            ).map(({ dir, arrow, slots, label }) => (
              <div
                key={dir}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-[11px]',
                  slotDir === dir
                    ? 'bg-white shadow-sm ring-1 ring-black/5 text-slate-700'
                    : 'text-slate-400'
                )}
              >
                <span>{arrow}</span>
                <span className="font-mono">{slots}</span>
                {slotDir === dir && (
                  <span className="ml-auto text-[9px] font-semibold text-slate-500">{label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function validationSummary(issues: LayoutValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { errors, warnings, hasIssues: issues.length > 0 };
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
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Inspector
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

        <div className="px-5 pt-2 pb-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-slate-900">Rack {rack.displayCode}</div>
            {showTaskNav && (
              <InspectorTaskNav value={objectWorkContext} onChange={setObjectWorkContext} />
            )}
          </div>
        </div>
      </div>

      <ValidationStrip issues={rackIssues} />

      <div className="flex flex-1 overflow-hidden">
        <InspectorSummaryBar
          rack={rack}
          faceA={faceA}
          faceB={faceB}
          rackCells={rackCells}
        />
        <div className="flex-1 overflow-y-auto">{renderTaskBody()}</div>
      </div>
    </aside>
  );
}
