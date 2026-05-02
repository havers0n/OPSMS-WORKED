import type { FloorWorkspace, LayoutDraft } from '@wos/domain';
import {
  useLayoutDraftState,
  useViewMode
} from '@/warehouse/editor/model/editor-selectors';

export function useWorkspaceLayout(workspace: FloorWorkspace | null | undefined): LayoutDraft | null {
  const localLayout = useLayoutDraftState();
  const viewMode = useViewMode();

  if (!workspace) {
    return localLayout;
  }

  if (viewMode === 'view' || viewMode === 'storage') {
    return workspace.latestPublished ?? localLayout ?? workspace.activeDraft ?? null;
  }

  // Prefer the local Zustand state in Layout mode so unsaved in-memory edits
  // remain visible without being flushed by a background workspace refetch.
  return localLayout ?? workspace.activeDraft ?? workspace.latestPublished ?? null;
}
