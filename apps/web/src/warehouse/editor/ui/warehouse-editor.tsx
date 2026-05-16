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
import { useT } from '@/shared/i18n';
import { StorageWorkspaceV2 } from './storage-workspace-v2';
import { ToolRail } from './tool-rail';
import { WorkspaceCanvasAndPanel } from './workspace-canvas-and-panel';

export function WarehouseEditor() {
  const t = useT();
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
          {t('warehouse.editor.selectContext')}
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
          {t('warehouse.editor.loadingWorkspace')}
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

  if (viewMode === 'storage') {
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
      aria-label={t('warehouse.editor.region')}
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
