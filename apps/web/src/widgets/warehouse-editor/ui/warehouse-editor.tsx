import { useEffect, useState } from 'react';
import { PanelRight } from 'lucide-react';
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
import { ToolRail } from './tool-rail';

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

  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Auto-open inspector when rack is selected or being created
  useEffect(() => {
    if (selectedRackId !== null || creatingRackId !== null) {
      setInspectorOpen(true);
    }
  }, [selectedRackId, creatingRackId]);

  // Auto-close inspector when selection is cleared
  useEffect(() => {
    if (selectedRackId === null && creatingRackId === null) {
      setInspectorOpen(false);
    }
  }, [selectedRackId, creatingRackId]);

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

  if (!currentDraft && !layoutDraft) {
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
          Loading layout…
        </div>
      </div>
    );
  }

  const handleAddRack = () => {
    setSelectedRackId([]);
    setEditorMode('place');
  };

  const handleCloseInspector = () => {
    setInspectorOpen(false);
    setSelectedRackId(null);
  };

  return (
    <div
      role="region"
      aria-label="Warehouse editor"
      className="flex h-full w-full overflow-hidden"
    >
      {/* Left: context-sensitive tool rail */}
      <ToolRail />

      {/* Center: canvas — takes all remaining space */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <EditorCanvas
          onAddRack={handleAddRack}
          onOpenInspector={() => setInspectorOpen(true)}
        />

        {/* Inspector toggle — appears when rack is selected but inspector is hidden */}
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

      {/* Right: collapsible inspector */}
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
          <RackInspector
            onClose={handleCloseInspector}
            onAddRack={handleAddRack}
          />
        </div>
      </div>
    </div>
  );
}
