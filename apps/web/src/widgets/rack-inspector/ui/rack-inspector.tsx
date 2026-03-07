import { generateLayoutCells, validateLayoutDraft } from '@wos/domain';
import { MousePointer2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { FaceBEmptyState } from '@/features/face-b-configure-mode/ui/face-b-empty-state';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';
import { FaceTab } from '@/features/rack-configure/ui/face-tab';
import { SummaryTab } from '@/features/rack-configure/ui/summary-tab';
import { useDraftDirtyState, useLayoutDraftState, useSelectedRackId, useSetFaceBMode } from '@/widgets/warehouse-editor/model/editor-selectors';

type InspectorTab = 'general' | 'faceA' | 'faceB' | 'summary';
type FaceBMode = 'mirror' | 'copy' | 'scratch' | null;

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'faceA', label: 'Face A' },
  { id: 'faceB', label: 'Face B' },
  { id: 'summary', label: 'Summary' }
];

function validationBadgeClass(isValid: boolean, issueCount: number) {
  if (isValid) return 'bg-emerald-100 text-emerald-800';
  if (issueCount > 0) return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export function RackInspector({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('general');
  const [faceBMode, setFaceBModeState] = useState<FaceBMode>(null);
  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const selectedRackId = useSelectedRackId();
  const setFaceBMode = useSetFaceBMode();
  const cachedValidation = useCachedLayoutValidation(layoutDraft?.layoutVersionId ?? null);

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const faceA = rack?.faces.find((face) => face.side === 'A');
  const faceB = rack?.faces.find((face) => face.side === 'B');

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
  const validationSource: 'preview' | 'server' = !isDraftDirty && cachedValidation.data ? 'server' : 'preview';
  const rackIssues = useMemo(
    () => validationResult.issues.filter((issue) => !issue.entityId || issue.entityId === rack?.id || rack?.faces.some((f) => f.id === issue.entityId)),
    [validationResult.issues, rack]
  );

  const previewAddresses = rackCells.slice(0, 4).map((cell) => cell.address.raw);

  const handleFaceBMode = (mode: Exclude<FaceBMode, null>) => {
    if (!rack) return;
    setFaceBModeState(mode);
    setFaceBMode(rack.id, mode);
  };

  // Guard: shouldn't normally be visible without a rack selected (parent controls visibility)
  if (!rack || !faceA || !faceB) {
    return (
      <aside className="flex h-full w-full flex-col items-center justify-center bg-white">
        <MousePointer2 className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">No rack selected</p>
      </aside>
    );
  }

  const facesCount = rack.faces.filter((f) => f.enabled).length;
  const totalSections = rack.faces.reduce((sum, f) => sum + f.sections.length, 0);
  const hasErrors = rackIssues.some((i) => i.severity === 'error');
  const hasWarnings = rackIssues.some((i) => i.severity === 'warning');
  const validLabel = hasErrors ? 'Invalid' : hasWarnings ? 'Warnings' : 'Valid';

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Sticky summary header */}
      <div className="border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
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

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-slate-900">Rack {rack.displayCode}</div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-400">{rack.id}</div>
          </div>
          <span
            className={[
              'rounded-full px-3 py-1 text-xs font-medium',
              validationBadgeClass(validationResult.isValid, rackIssues.filter(i => i.severity === 'error').length)
            ].join(' ')}
          >
            {validLabel}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <div className="rounded-xl border border-[var(--border-muted)] bg-white p-2.5 shadow-sm">
            <div className="text-slate-500">Kind</div>
            <div className="mt-1 font-medium capitalize text-slate-900">{rack.kind}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-white p-2.5 shadow-sm">
            <div className="text-slate-500">Axis</div>
            <div className="mt-1 font-mono font-medium text-slate-900">{rack.axis}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-white p-2.5 shadow-sm">
            <div className="text-slate-500">Sections</div>
            <div className="mt-1 font-medium text-slate-900">{totalSections}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-muted)] bg-white p-2.5 shadow-sm">
            <div className="text-slate-500">Cells</div>
            <div className="mt-1 font-mono font-medium text-slate-900">{rackCells.length}</div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <span>Faces active: {facesCount}</span>
          <span>
            {rack.totalLength.toFixed(1)} m × {rack.depth.toFixed(1)} m · {rack.rotationDeg}°
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-[var(--border-muted)] px-3 py-2.5">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'rounded-xl px-3 py-2 text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-auto bg-white p-5">
        {activeTab === 'general' && <GeneralTab rack={rack} />}
        {activeTab === 'faceA' && <FaceTab title="Face A" rackId={rack.id} face={faceA} />}
        {activeTab === 'faceB' && faceB.sections.length === 0 ? (
          <FaceBEmptyState selectedMode={faceBMode} onSelectMode={handleFaceBMode} />
        ) : null}
        {activeTab === 'faceB' && faceB.sections.length > 0 && (
          <FaceTab title="Face B" rackId={rack.id} face={faceB} />
        )}
        {activeTab === 'summary' && (
          <SummaryTab
            rack={rack}
            previewAddresses={previewAddresses}
            validationResult={validationResult}
            validationSource={validationSource}
            generatedCellCount={rackCells.length}
          />
        )}
      </div>
    </aside>
  );
}
