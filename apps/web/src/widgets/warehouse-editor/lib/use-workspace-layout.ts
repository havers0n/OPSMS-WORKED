import type { FloorWorkspace, LayoutDraft } from '@wos/domain';
import { useLayoutDraftState, useViewMode } from '@/entities/layout-version/model/editor-selectors';

export function useWorkspaceLayout(workspace: FloorWorkspace | null | undefined): LayoutDraft | null {
  const viewMode = useViewMode();
  const localLayout = useLayoutDraftState();

  if (!workspace) {
    return localLayout;
  }

  if (viewMode === 'placement' && workspace.latestPublished) {
    return workspace.latestPublished;
  }

  return localLayout ?? workspace.activeDraft ?? workspace.latestPublished ?? null;
}
