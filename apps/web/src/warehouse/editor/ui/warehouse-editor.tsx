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
} from '@/warehouse/editor/model/editor-selectors';
import { useModeStore } from '@/warehouse/editor/model/mode-store';
import { StorageWorkspaceV2 } from './storage-workspace-v2';
import { ToolRail } from './tool-rail';
import { WorkspaceCanvasAndPanel } from './workspace-canvas-and-panel';

const ENABLE_STORAGE_WORKSPACE_V2 = true;

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: workspace } = useFloorWorkspace(activeFloorId);
  const viewMode = useModeStore((s) => s.viewMode);
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

  const handleCloseInspector = () => {
    clearSelection();
  };

  // V2 gate: route to StorageWorkspaceV2 if enabled and in storage mode
  if (viewMode === 'storage' && ENABLE_STORAGE_WORKSPACE_V2) {
    return (
      <StorageWorkspaceV2
        workspace={workspace ?? null}
        onAddRack={handleAddRack}
        onCloseInspector={handleCloseInspector}
      />
    );
  }

  return (
    <div
      role="region"
      aria-label="Warehouse editor"
      className="flex h-full w-full overflow-hidden"
    >
      <ToolRail />

      <WorkspaceCanvasAndPanel
        workspace={workspace ?? null}
        onAddRack={handleAddRack}
        onCloseInspector={handleCloseInspector}
      />
    </div>
  );
}
