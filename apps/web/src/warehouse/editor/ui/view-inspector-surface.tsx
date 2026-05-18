import type { FloorWorkspace } from '@wos/domain';
import { InspectorShell } from '@/shared/ui/inspector-shell';
import { ViewInspectorRouter } from './view-inspector-router';

type ViewInspectorSurfaceProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
};

export function ViewInspectorSurface({ workspace, onClose }: ViewInspectorSurfaceProps) {
  return (
    <InspectorShell
      data-testid="view-inspector-surface"
      className="h-full rounded-none border-0 bg-transparent"
      contentClassName="h-full space-y-0 p-0"
    >
      <ViewInspectorRouter workspace={workspace} onClose={onClose} />
    </InspectorShell>
  );
}
