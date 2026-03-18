import type { FloorWorkspace, LayoutDraft } from '@wos/domain';
import { useLayoutDraftState } from '@/entities/layout-version/model/editor-selectors';

export function useWorkspaceLayout(workspace: FloorWorkspace | null | undefined): LayoutDraft | null {
  const localLayout = useLayoutDraftState();

  if (!workspace) {
    return localLayout;
  }

  // Prefer the local Zustand state for all edit modes (Layout, Semantics, etc.)
  // so that unsaved in-memory edits remain visible without being flushed by a
  // background workspace refetch.
  //
  // NOTE: Storage (placement) mode is intentionally excluded from this hook's
  // concern.  EditorCanvas derives `placementLayout = workspace.latestPublished`
  // directly and uses it as the rack tree source instead.  This keeps the
  // published rack UUID space aligned with publishedCellsByStructure so that
  // RackCells cell-lookup keys always match.  Showing draft positions in Storage
  // mode would be misleading anyway — Storage operations are scoped to the
  // published layout.
  return localLayout ?? workspace.activeDraft ?? workspace.latestPublished ?? null;
}
