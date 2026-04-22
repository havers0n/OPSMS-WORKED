import type { FloorWorkspace } from '@wos/domain';
import { useStorageFocusSelectedRackId } from '../model/v2/v2-selectors';
import { StorageInspectorV2 } from './storage-inspector-v2';
import { StorageNavigator } from './storage-navigator';
import { WorkspaceCanvasAndPanel } from './workspace-canvas-and-panel';

interface StorageWorkspaceV2Props {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onOpenInspector: () => undefined;
  onCloseInspector: () => void;
}

/**
 * StorageWorkspaceV2 — Dumb composition root for storage mode V2
 *
 * This is a gated alternative to the legacy WarehouseEditor when in storage mode.
 * It composes:
 * - StorageNavigator (left panel, V2 surface)
 * - WorkspaceCanvasAndPanel (center + right, shared with legacy path)
 *
 * All state and handlers are received from parent (WarehouseEditor).
 * This is pure composition with no local logic.
 *
 * **Relationship to PR1–PR7:**
 * - PR1: V2 state primitives (navigation, selection, task stores)
 * - PR2: StorageNavigator shell component
 * - PR3: This workspace container (gated V2 host)
 * - PR4: StorageNavigator made interactive (selection wired to selection-store)
 * - PR5: StorageInspectorV2 mounted here; legacy RightSidePanelSlot suppressed in V2 path
 * - PR6: workspace threaded to navigator + inspector for real data cutover
 * - PR7: isStorageV2 + hideContextPanel passed; StorageFocusStore is now sole V2 focus writer
 *
 * **Enabled by:** ENABLE_STORAGE_WORKSPACE_V2 const in warehouse-editor.tsx
 */
export function StorageWorkspaceV2({
  workspace,
  onAddRack,
  onOpenInspector,
  onCloseInspector
}: StorageWorkspaceV2Props) {
  const selectedRackId = useStorageFocusSelectedRackId();
  const showLeftPanel = selectedRackId !== null;
  const showRightPanel = selectedRackId !== null;

  return (
    <div
      role="region"
      aria-label="Storage workspace"
      className="flex h-full w-full overflow-hidden"
    >
      {showLeftPanel && <StorageNavigator workspace={workspace} />}

      <WorkspaceCanvasAndPanel
        workspace={workspace}
        onAddRack={onAddRack}
        onOpenInspector={onOpenInspector}
        onCloseInspector={onCloseInspector}
        hideRightPanel
        hideContextPanel
        isStorageV2
      />

      {showRightPanel && <StorageInspectorV2 workspace={workspace} />}
    </div>
  );
}
