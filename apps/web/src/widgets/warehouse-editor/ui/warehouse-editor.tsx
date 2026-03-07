import { useEffect } from 'react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useActiveLayoutDraft } from '@/entities/layout-version/api/use-active-layout-draft';
import { RackInspector } from '@/widgets/rack-inspector/ui/rack-inspector';
import { useInitializeDraft, useLayoutDraftState, useResetDraft } from '@/widgets/warehouse-editor/model/editor-selectors';
import { EditorCanvas } from './editor-canvas';

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: layoutDraft } = useActiveLayoutDraft(activeFloorId);
  const currentDraft = useLayoutDraftState();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();

  useEffect(() => {
    if (!activeFloorId) {
      resetDraft();
    }
  }, [activeFloorId, resetDraft]);

  useEffect(() => {
    if (layoutDraft) {
      initializeDraft(layoutDraft);
    }
  }, [initializeDraft, layoutDraft]);

  if (!activeFloorId || (!currentDraft && !layoutDraft)) {
    return (
      <div className="flex h-[calc(100vh-11rem)] items-center justify-center">
        <div className="rounded-[22px] border border-[var(--border-muted)] bg-[var(--surface-primary)] px-8 py-6 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
          Loading warehouse editor...
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-11rem)] grid-cols-[minmax(0,1fr)_460px] gap-4 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] shadow-[var(--shadow-panel)]">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-6 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Workspace</div>
            <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">Canvas = spatial context only</div>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Select, move, rotate by 90°, then configure structure in the inspector.</div>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <div className="h-full overflow-hidden rounded-[20px] border border-[var(--border-muted)] bg-white shadow-inner">
            <EditorCanvas />
          </div>
        </div>
      </div>
      <RackInspector />
    </div>
  );
}
