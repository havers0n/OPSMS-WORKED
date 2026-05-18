import type { FloorWorkspace } from '@wos/domain';
import { Panel } from '@/shared/ui/panel';
import { useEditorSelection } from '@/warehouse/editor/model/editor-selectors';
import { ViewInspectorSurface } from './view-inspector-surface';
import { hasInspectableViewSelection } from './view-inspector-router-logic';

const VIEW_PANEL_WIDTH = 'min(400px, 100vw)';

type ViewSidePanelSlotProps = {
  workspace: FloorWorkspace | null;
  onCloseInspector: () => void;
};

export function ViewSidePanelSlot({
  workspace,
  onCloseInspector
}: ViewSidePanelSlotProps) {
  const selection = useEditorSelection();
  const isOpen = hasInspectableViewSelection(selection);

  return (
    <div
      data-testid="view-side-panel-slot"
      className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: isOpen ? VIEW_PANEL_WIDTH : '0px' }}
    >
      <Panel
        padding="none"
        tone="default"
        className="h-full overflow-hidden rounded-none border-y-0 border-r-0 transition-transform duration-300 ease-in-out"
        style={{
          width: VIEW_PANEL_WIDTH,
          borderColor: 'var(--border-muted)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        {isOpen ? (
          <ViewInspectorSurface
            workspace={workspace}
            onClose={onCloseInspector}
          />
        ) : null}
      </Panel>
    </div>
  );
}
