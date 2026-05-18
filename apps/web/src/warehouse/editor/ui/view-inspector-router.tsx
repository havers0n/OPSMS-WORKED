import type { FloorWorkspace } from '@wos/domain';
import { useEditorSelection } from '@/warehouse/editor/model/editor-selectors';
import { RackViewInspector } from './rack-view-inspector';
import { CellPlacementInspector } from './mode-panels/cell-placement-inspector';
import { ContainerPlacementInspector } from './mode-panels/container-placement-inspector';
import { PlacementModePanel } from './mode-panels/placement-mode-panel';
import { resolveViewInspectorKind } from './view-inspector-router-logic';

type ViewInspectorRouterProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
};

export function ViewInspectorRouter({ workspace, onClose }: ViewInspectorRouterProps) {
  const selection = useEditorSelection();
  const kind = resolveViewInspectorKind(selection);

  switch (kind) {
    case 'rack-view':
      return <RackViewInspector workspace={workspace} onClose={onClose} />;
    case 'placement-cell':
      return <CellPlacementInspector workspace={workspace} />;
    case 'placement-container':
      return <ContainerPlacementInspector workspace={workspace} />;
    case 'placement-placeholder':
      return <PlacementModePanel />;
  }
}
