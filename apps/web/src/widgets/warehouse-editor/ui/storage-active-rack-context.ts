import type { Cell } from '@wos/domain';
import type { EditorSelection, ViewMode } from '@/widgets/warehouse-editor/model/editor-types';

type ResolveStorageActiveRackIdParams = {
  viewMode: ViewMode;
  selection: EditorSelection;
  selectedRackId: string | null;
  publishedCellsById: Map<string, Cell>;
};

export function resolveStorageActiveRackId({
  viewMode,
  selection,
  selectedRackId,
  publishedCellsById
}: ResolveStorageActiveRackIdParams): string | null {
  if (viewMode !== 'storage') return selectedRackId;

  if (selection.type === 'rack') {
    return selection.rackIds[0] ?? null;
  }

  if (selection.type === 'cell') {
    return publishedCellsById.get(selection.cellId)?.rackId ?? null;
  }

  return null;
}
