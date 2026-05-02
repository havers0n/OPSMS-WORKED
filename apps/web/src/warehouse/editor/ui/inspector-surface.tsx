import type { FloorWorkspace } from '@wos/domain';
import { InspectorShell } from '@/shared/ui/inspector-shell';
import { InspectorRouter } from './inspector-router';

type InspectorSurfaceProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
  enableLegacyStorageRouting?: boolean;
};

export function InspectorSurface({
  workspace,
  onClose,
  enableLegacyStorageRouting = false
}: InspectorSurfaceProps) {
  return (
    <InspectorShell
      data-testid="inspector-surface"
      className="h-full rounded-none border-0 bg-transparent"
      contentClassName="h-full space-y-0 p-0"
    >
      <InspectorRouter
        workspace={workspace}
        onClose={onClose}
        enableLegacyStorageRouting={enableLegacyStorageRouting}
      />
    </InspectorShell>
  );
}
