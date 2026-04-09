import { useEffect } from 'react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useLayoutDraftAutosave } from '@/features/layout-draft-save/model/use-layout-draft-autosave';
import {
  useClearSelection,
  useInitializeDraft,
  useLayoutDraftState,
  useResetDraft,
  useSetEditorMode
} from '@/entities/layout-version/model/editor-selectors';
import { ContextPanel } from './context-panel';
import { EditorCanvas } from './editor-canvas';
import { RightSidePanelSlot } from './right-side-panel-slot';
import { ToolRail } from './tool-rail';

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: workspace } = useFloorWorkspace(activeFloorId);
  useLayoutDraftAutosave(activeFloorId);
  const workspaceLayout = workspace?.activeDraft ?? workspace?.latestPublished ?? null;
  const currentDraft = useLayoutDraftState();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();
  const clearSelection = useClearSelection();
  const setEditorMode = useSetEditorMode();

  useEffect(() => {
    if (!activeFloorId) {
      resetDraft();
    }
  }, [activeFloorId, resetDraft]);

  useEffect(() => {
    if (workspaceLayout) {
      initializeDraft(workspaceLayout);
    }
  }, [initializeDraft, workspaceLayout]);

  if (!activeFloorId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="rounded-2xl px-8 py-6 text-sm"
          style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-muted)',
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-soft)'
          }}
        >
          Select a site and floor from the top bar to load the editor.
        </div>
      </div>
    );
  }

  if (!currentDraft && !workspaceLayout) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="rounded-2xl px-8 py-6 text-sm"
          style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-muted)',
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-soft)'
          }}
        >
          Loading workspace...
        </div>
      </div>
    );
  }

  const handleAddRack = () => {
    clearSelection();
    setEditorMode('place');
  };

  const handleDrawZone = () => {
    clearSelection();
    setEditorMode('draw-zone');
  };

  const handleCloseInspector = () => {
    clearSelection();
  };

  return (
    <div
      role="region"
      aria-label="Warehouse editor"
      className="flex h-full w-full overflow-hidden"
    >
      <ToolRail />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <EditorCanvas
          workspace={workspace ?? null}
          onAddRack={handleAddRack}
          onOpenInspector={() => undefined}
        />

        <ContextPanel
          workspace={workspace ?? null}
          onAddRack={handleAddRack}
          onDrawZone={handleDrawZone}
          onOpenInspector={() => undefined}
        />
      </div>

      <RightSidePanelSlot
        workspace={workspace ?? null}
        onCloseInspector={handleCloseInspector}
      />
    </div>
  );
}
