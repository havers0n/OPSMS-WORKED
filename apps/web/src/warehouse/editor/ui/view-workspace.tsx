import type { FloorWorkspace } from '@wos/domain';
import { ToolRail } from './tool-rail';
import { EditorCanvas } from './editor-canvas';
import { ViewSidePanelSlot } from './view-side-panel-slot';

type ViewWorkspaceProps = {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onCloseInspector: () => void;
};

export function ViewWorkspace({
  workspace,
  onAddRack,
  onCloseInspector
}: ViewWorkspaceProps) {
  return (
    <div
      role="region"
      aria-label="Warehouse view workspace"
      className="flex h-full w-full overflow-hidden"
    >
      <ToolRail />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <EditorCanvas
          workspace={workspace}
          onAddRack={onAddRack}
          onOpenInspector={() => undefined}
        />
      </div>

      <ViewSidePanelSlot
        workspace={workspace}
        onCloseInspector={onCloseInspector}
      />
    </div>
  );
}
