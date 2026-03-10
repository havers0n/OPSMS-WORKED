import { useEffect } from 'react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useActiveLayoutDraft } from '@/entities/layout-version/api/use-active-layout-draft';
import {
  useCreatingRackId,
  useInitializeDraft,
  useLayoutDraftState,
  useResetDraft,
  useSelectedRackId,
  useSetEditorMode,
  useSetSelectedRackId
} from '@/entities/layout-version/model/editor-selectors';
import { EditorCanvas } from './editor-canvas';
import { RackInspector } from './rack-inspector';

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: layoutDraft } = useActiveLayoutDraft(activeFloorId);
  const currentDraft = useLayoutDraftState();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();
  const selectedRackId = useSelectedRackId();
  const creatingRackId = useCreatingRackId();
  const setSelectedRackId = useSetSelectedRackId();
  const setEditorMode = useSetEditorMode();

  // Inspector is visible when a rack is selected OR being created
  const inspectorOpen = selectedRackId !== null || creatingRackId !== null;

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

  const handleAddRack = () => {
    setSelectedRackId([]);
    setEditorMode('place');
  };

  return (
    <div
      role="region"
      aria-label="Warehouse editor"
      className="flex h-full overflow-hidden rounded-[24px] border border-[var(--border-muted)] bg-[var(--surface-primary)] shadow-[var(--shadow-panel)]"
    >
      {/* Canvas takes all remaining space */}
      <div className="h-full min-w-0 flex-1">
        <EditorCanvas onAddRack={handleAddRack} />
      </div>

      {/* Inspector panel — slides in from the right when a rack is selected/created */}
      <div
        className={[
          'shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
          inspectorOpen ? 'w-[460px]' : 'w-0'
        ].join(' ')}
      >
        <div
          className={[
            'h-full w-[460px] border-l border-[var(--border-muted)] transition-transform duration-300 ease-in-out',
            inspectorOpen ? 'translate-x-0' : 'translate-x-full'
          ].join(' ')}
        >
          <RackInspector
            onClose={() => setSelectedRackId([])}
            onAddRack={handleAddRack}
          />
        </div>
      </div>
    </div>
  );
}
