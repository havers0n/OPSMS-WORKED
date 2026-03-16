import type { FloorWorkspace, LayoutDraft } from '@wos/domain';
import { useLayoutDraftState } from '@/entities/layout-version/model/editor-selectors';

export function useWorkspaceLayout(workspace: FloorWorkspace | null | undefined): LayoutDraft | null {
  const localLayout = useLayoutDraftState();

  if (!workspace) {
    return localLayout;
  }

  // Always prefer the local Zustand state so that unsaved edits and mode
  // switches (Layout ↔ Storage) show a consistent canvas.  The previous
  // branch that returned workspace.latestPublished when viewMode === 'placement'
  // caused the canvas to flip to the published layout the moment the user
  // entered Storage mode, making it look like all edits had been lost.
  // Cell occupancy data for placement is fetched separately via
  // useFloorLocationOccupancy and does not depend on which layout is shown.
  return localLayout ?? workspace.activeDraft ?? workspace.latestPublished ?? null;
}
