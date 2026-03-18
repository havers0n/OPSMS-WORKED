import { useEffect, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useCreatingRackId,
  useInitializeDraft,
  useLayoutDraftState,
  useResetDraft,
  useSelectedRackId,
  useSetEditorMode,
  useSetSelectedRackId,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { EditorCanvas } from './editor-canvas';
import { InspectorRouter } from './inspector-router';
import { ToolRail } from './tool-rail';

export function WarehouseEditor() {
  const activeFloorId = useActiveFloorId();
  const { data: workspace } = useFloorWorkspace(activeFloorId);
  const workspaceLayout = workspace?.activeDraft ?? workspace?.latestPublished ?? null;
  const currentDraft = useLayoutDraftState();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();
  const viewMode = useViewMode();
  const selectedRackId = useSelectedRackId();
  const creatingRackId = useCreatingRackId();
  const setSelectedRackId = useSetSelectedRackId();
  const setEditorMode = useSetEditorMode();

  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    if (viewMode !== 'layout') {
      setInspectorOpen(true);
    } else {
      setInspectorOpen(selectedRackId !== null || creatingRackId !== null);
    }
  }, [viewMode, selectedRackId, creatingRackId]);

  useEffect(() => {
    if (!activeFloorId) {
      resetDraft();
    }
  }, [activeFloorId, resetDraft]);

  useEffect(() => {
    if (workspaceLayout) {
      const pos = workspaceLayout.rackIds
        .map((id) => `${id.slice(0,8)} x=${workspaceLayout.racks[id]?.x} y=${workspaceLayout.racks[id]?.y}`)
        .join(' | ');
      console.log(
        '[BUG-B] workspaceLayout changed →', workspaceLayout.layoutVersionId, workspaceLayout.state, '\n  ', pos
      );
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
    setSelectedRackId(null);
    setEditorMode('place');
  };

  const handleCloseInspector = () => {
    setInspectorOpen(false);
    if (viewMode === 'layout') {
      setSelectedRackId(null);
    }
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
          onOpenInspector={() => setInspectorOpen(true)}
        />

        {selectedRackId && !inspectorOpen && (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            title="Open inspector"
            className="pointer-events-auto absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition-colors hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
        style={{ width: inspectorOpen ? '320px' : '0px' }}
      >
        <div
          className="h-full overflow-hidden border-l transition-transform duration-300 ease-in-out"
          style={{
            width: '320px',
            borderColor: 'var(--border-muted)',
            transform: inspectorOpen ? 'translateX(0)' : 'translateX(100%)'
          }}
        >
          <InspectorRouter
            workspace={workspace ?? null}
            onClose={handleCloseInspector}
            onAddRack={handleAddRack}
          />
        </div>
      </div>
    </div>
  );
}
