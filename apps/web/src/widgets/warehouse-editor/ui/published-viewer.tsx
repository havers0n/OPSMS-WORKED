import { useEffect, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import {
  useClearSelection,
  useInitializeDraft,
  useResetDraft,
  useSelectedRackId,
  useSetEditorMode,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { EditorCanvas } from './editor-canvas';
import { InspectorRouter } from './inspector-router';
import { ToolRail } from './tool-rail';

/**
 * PublishedViewer — read-only shell for floors that have a published layout
 * but no active draft. Renders the full canvas + inspector with structure
 * locked, and provides a prominent "Create Draft" CTA to begin editing.
 *
 * Mounted by WarehouseContent when: setupState === 'workspace_ready'
 *   && !hasDraft && hasPublished.
 *
 * On "Create Draft": React Query invalidates the workspace cache, activeDraft
 * becomes non-null, and WarehouseContent automatically switches to
 * WarehouseEditor — no manual navigation needed.
 */
export function PublishedViewer() {
  const activeFloorId = useActiveFloorId();
  const { data: workspace } = useFloorWorkspace(activeFloorId);
  const clearSelection = useClearSelection();
  const initializeDraft = useInitializeDraft();
  const resetDraft = useResetDraft();
  const viewMode = useViewMode();
  const selectedRackId = useSelectedRackId();
  const setEditorMode = useSetEditorMode();

  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Bootstrap the store from the published layout so the canvas renders racks.
  // Also reset editorMode to 'select' — the place tool is unavailable in read-only mode
  // and the mode may be stale from a prior WarehouseEditor session.
  useEffect(() => {
    const readonlyLayout = workspace?.latestPublished ?? workspace?.activeDraft ?? null;
    if (readonlyLayout) {
      initializeDraft(readonlyLayout);
      setEditorMode('select');
    }
  }, [initializeDraft, setEditorMode, workspace?.activeDraft, workspace?.latestPublished]);

  // Reset store when floor is deselected.
  useEffect(() => {
    if (!activeFloorId) {
      resetDraft();
    }
  }, [activeFloorId, resetDraft]);

  // Mirror WarehouseEditor inspector open logic (no active layout task in read-only mode).
  useEffect(() => {
    if (viewMode !== 'layout') {
      setInspectorOpen(true);
    } else {
      setInspectorOpen(selectedRackId !== null);
    }
  }, [viewMode, selectedRackId]);

  const handleCloseInspector = () => {
    setInspectorOpen(false);
    clearSelection();
  };

  // Rack placement is not available in the published viewer.
  const handleAddRack = () => undefined;

  return (
    <div
      role="region"
      aria-label="Published warehouse layout"
      className="flex h-full w-full flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
