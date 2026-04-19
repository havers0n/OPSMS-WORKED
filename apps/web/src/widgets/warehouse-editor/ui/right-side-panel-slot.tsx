import type { FloorWorkspace } from '@wos/domain';
import { Panel } from '@/shared/ui/panel';
import {
  useActiveTask,
  useEditorSelection,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { InspectorSurface } from './inspector-surface';
import { resolveRightSideRoute } from './right-side-routing-logic';
import { TaskSurface } from './task-surface';

type RightSidePanelSlotProps = {
  workspace: FloorWorkspace | null;
  onCloseInspector: () => void;
};

export function RightSidePanelSlot({ workspace, onCloseInspector }: RightSidePanelSlotProps) {
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const activeTask = useActiveTask();

  const route = resolveRightSideRoute(viewMode, selection, activeTask);
  const isOpen = route !== 'closed';

  return (
    <div
      className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: isOpen ? '560px' : '0px' }}
    >
      <Panel
        padding="none"
        tone="default"
        className="h-full overflow-hidden rounded-none border-y-0 border-r-0 transition-transform duration-300 ease-in-out"
        style={{
          width: '560px',
          borderColor: 'var(--border-muted)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        {route === 'task-surface' ? (
          <TaskSurface workspace={workspace} />
        ) : route === 'inspector-surface' ? (
          <InspectorSurface workspace={workspace} onClose={onCloseInspector} />
        ) : null}
      </Panel>
    </div>
  );
}
