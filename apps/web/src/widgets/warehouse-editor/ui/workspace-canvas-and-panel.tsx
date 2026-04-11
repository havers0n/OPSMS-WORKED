import type { FloorWorkspace } from '@wos/domain';
import { ContextPanel } from './context-panel';
import { EditorCanvas } from './editor-canvas';
import { RightSidePanelSlot } from './right-side-panel-slot';

interface WorkspaceCanvasAndPanelProps {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onOpenInspector: () => undefined;
  onCloseInspector: () => void;
  /**
   * When true, suppresses the legacy RightSidePanelSlot so the V2 path can
   * mount its own right surface (StorageInspectorV2) alongside this component.
   * Defaults to false — has no effect on the layout-mode or legacy storage path.
   */
  hideRightPanel?: boolean;
}

/**
 * Shared workspace body composition: Canvas + ContextPanel + RightSidePanelSlot
 *
 * Extracted from WarehouseEditor to be reused by both:
 * - Layout mode (WarehouseEditor with ToolRail)
 * - Storage V2 mode (StorageWorkspaceV2 with StorageNavigator)
 *
 * This ensures identical behavior and prop semantics in both paths.
 */
export function WorkspaceCanvasAndPanel({
  workspace,
  onAddRack,
  onOpenInspector,
  onCloseInspector,
  hideRightPanel,
}: WorkspaceCanvasAndPanelProps) {
  return (
    <>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <EditorCanvas
          workspace={workspace}
          onAddRack={onAddRack}
          onOpenInspector={onOpenInspector}
        />

        <ContextPanel
          workspace={workspace}
          onOpenInspector={onOpenInspector}
        />
      </div>

      {!hideRightPanel && (
        <RightSidePanelSlot
          workspace={workspace}
          onCloseInspector={onCloseInspector}
        />
      )}
    </>
  );
}
