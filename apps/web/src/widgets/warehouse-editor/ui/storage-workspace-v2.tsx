import type { FloorWorkspace } from '@wos/domain';
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
 * **Relationship to PR1 & PR2:**
 * - PR1: V2 state primitives (navigation, selection, task stores)
 * - PR2: StorageNavigator shell component
 * - PR3: This workspace container (gated V2 host)
 *
 * **Enabled by:** ENABLE_STORAGE_WORKSPACE_V2 const in warehouse-editor.tsx
 */
export function StorageWorkspaceV2({
  workspace,
  onAddRack,
  onOpenInspector,
  onCloseInspector
}: StorageWorkspaceV2Props) {
  return (
    <div
      role="region"
      aria-label="Storage workspace"
      className="flex h-full w-full overflow-hidden"
    >
      <StorageNavigator />

      <WorkspaceCanvasAndPanel
        workspace={workspace}
        onAddRack={onAddRack}
        onOpenInspector={onOpenInspector}
        onCloseInspector={onCloseInspector}
      />
    </div>
  );
}
