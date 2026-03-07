import { generateLayoutCells, validateLayoutDraft } from '@wos/domain';
import { useMemo, useState } from 'react';
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

export function RackInspector() {
  const [activeTab, setActiveTab] = useState<InspectorTab>('general');
  const [faceBMode, setFaceBModeState] = useState<FaceBMode>(null);
  const layoutDraft = useLayoutDraftState();
  const selectedRackId = useSelectedRackId();
  const isDraftDirty = useDraftDirtyState();
  const setFaceBMode = useSetFaceBMode();

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : layoutDraft?.racks[layoutDraft.rackIds[0]];
  const faceA = rack?.faces.find((face) => face.side === 'A');
  const faceB = rack?.faces.find((face) => face.side === 'B');

  const generatedCells = useMemo(() => (layoutDraft ? generateLayoutCells(layoutDraft) : []), [layoutDraft]);
  const validationResult = useMemo(() => (layoutDraft ? validateLayoutDraft(layoutDraft) : { isValid: false, issues: [] }), [layoutDraft]);
  const previewAddresses = generatedCells.slice(0, 4).map((cell) => cell.address.raw);

  const handleFaceBMode = (mode: Exclude<FaceBMode, null>) => {
    if (!rack) {
      return;
    }

    setFaceBModeState(mode);
    setFaceBMode(rack.id, mode);
  };

  if (!layoutDraft || !rack || !faceA || !faceB) {
    return (
      <aside className="flex w-[460px] shrink-0 items-center justify-center rounded-[24px] border border-[var(--border-muted)] bg-white p-6 text-sm text-slate-500 shadow-[var(--shadow-soft)]">
        Loading rack draft...
      </aside>
    );
  }

  return (
    <aside className="flex w-[460px] shrink-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border-muted)] bg-white shadow-[var(--shadow-panel)]">
      <div className="border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-5 py-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Inspector</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-slate-900">Rack {rack.displayCode}</div>
            <div className="text-xs text-slate-500">Layout draft {layoutDraft.layoutVersionId}</div>
          </div>
          <span className={['rounded-full px-3 py-1.5 text-xs font-medium', validationResult.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'].join(' ')}>
            {validationResult.isValid ? 'Valid' : `${validationResult.issues.length} issues`}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3 text-xs text-slate-600">
          <div className="rounded-2xl border border-[var(--border-muted)] bg-white p-3 shadow-sm">
            <div className="font-medium text-slate-500">Rack</div>
            <div className="mt-1 font-mono text-slate-900">{rack.displayCode}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border-muted)] bg-white p-3 shadow-sm">
            <div className="font-medium text-slate-500">Type</div>
            <div className="mt-1 text-slate-900">{rack.kind}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border-muted)] bg-white p-3 shadow-sm">
            <div className="font-medium text-slate-500">Cells</div>
            <div className="mt-1 font-mono text-slate-900">{generatedCells.length}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border-muted)] bg-white p-3 shadow-sm">
            <div className="font-medium text-slate-500">Draft</div>
            <div className="mt-1 text-slate-900">{isDraftDirty ? 'Unsaved' : 'Saved'}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border-muted)] px-3 py-3">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={['rounded-xl px-3 py-2 text-sm transition-colors', activeTab === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'].join(' ')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white p-5">
        {activeTab === 'general' && <GeneralTab rack={rack} />}
        {activeTab === 'faceA' && <FaceTab title="Face A" rackId={rack.id} face={faceA} />}
        {activeTab === 'faceB' && faceB.sections.length === 0 ? <FaceBEmptyState selectedMode={faceBMode} onSelectMode={handleFaceBMode} /> : null}
        {activeTab === 'faceB' && faceB.sections.length > 0 && <FaceTab title="Face B" rackId={rack.id} face={faceB} />}
        {activeTab === 'summary' && <SummaryTab rack={rack} previewAddresses={previewAddresses} validationResult={validationResult} generatedCellCount={generatedCells.length} />}
      </div>
    </aside>
  );
}
