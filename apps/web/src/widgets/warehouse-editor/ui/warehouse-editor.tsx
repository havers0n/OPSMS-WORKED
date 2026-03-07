import { useEffect } from 'react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useActiveLayoutDraft } from '@/entities/layout-version/api/use-active-layout-draft';
import { RackInspector } from '@/widgets/rack-inspector/ui/rack-inspector';
import {
  useInitializeDraft,
  useLayoutDraftState,
  useResetDraft,
  useSelectedRackId,
  useSetSelectedRackId
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { EditorCanvas } from './editor-canvas';

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: layoutDraft } = useActiveLayoutDraft(activeFloorId);
  const currentDraft = useLayoutDraftState();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();
  const selectedRackId = useSelectedRackId();
  const setSelectedRackId = useSetSelectedRackId();

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

  if (!activeFloorId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-[22px] border border-[var(--border-muted)] bg-[var(--surface-primary)] px-8 py-6 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
          Select a site and floor from the top bar to load the editor.
        </div>
      </div>
    );
  }

  if (!currentDraft && !layoutDraft) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-[22px] border border-[var(--border-muted)] bg-[var(--surface-primary)] px-8 py-6 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
          Loading layout…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] shadow-[var(--shadow-panel)]">
      {/* Canvas — fills all remaining space; shrinks when inspector is open */}
      <div className="h-full min-w-0 flex-1">
        <EditorCanvas />
      </div>

      {/* Inspector — slides in as a flex sibling; canvas resizes via ResizeObserver */}
      {selectedRackId && (
        <div className="w-[460px] shrink-0 border-l border-[var(--border-muted)]">
          <RackInspector onClose={() => setSelectedRackId(null)} />
        </div>
      )}
    </div>
  );
}
