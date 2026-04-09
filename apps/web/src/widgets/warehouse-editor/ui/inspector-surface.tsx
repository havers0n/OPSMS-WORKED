import type { FloorWorkspace } from '@wos/domain';
import { InspectorRouter } from './inspector-router';

type InspectorSurfaceProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
};

export function InspectorSurface({ workspace, onClose }: InspectorSurfaceProps) {
  return (
    <div data-testid="inspector-surface" className="h-full">
      <InspectorRouter workspace={workspace} onClose={onClose} />
    </div>
  );
}
