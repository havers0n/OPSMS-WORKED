import {
  useClearHighlightedCellIds,
  useEditorSelection,
  useHighlightedCellIds,
  useSelectedCellId,
  useSetHighlightedCellIds,
  useSetSelectedCellId
} from '@/warehouse/editor/model/editor-selectors';
import { useEditorStore } from '@/warehouse/editor/model/editor-store';
import { useInteractionStore } from '@/warehouse/editor/model/interaction-store';
import type { EditorSelection } from '@/warehouse/editor/model/editor-types';

export type WarehouseSelection = EditorSelection;

export const useWarehouseSelection = useEditorSelection;
export const useWarehouseSelectedCellId = useSelectedCellId;
export const useSetWarehouseSelectedCellId = useSetSelectedCellId;
export const useWarehouseHighlightedCellIds = useHighlightedCellIds;
export const useSetWarehouseHighlightedCells = useSetHighlightedCellIds;
export const useClearWarehouseHighlightedCells = useClearHighlightedCellIds;

export function getWarehouseSelectionSnapshot(): WarehouseSelection {
  return useInteractionStore.getState().selection;
}

export const warehouseInteractionActions = {
  setSelectedRackId: (rackId: string | null) =>
    useEditorStore.getState().setSelectedRackId(rackId),
  setSelectedCellId: (cellId: string | null) =>
    useEditorStore.getState().setSelectedCellId(cellId),
  setHighlightedCells: (cellIds: string[]) =>
    useInteractionStore.getState().setHighlightedCellIds(cellIds),
  clearHighlightedCells: () => useInteractionStore.getState().clearHighlightedCellIds(),
  resetAll: () => useInteractionStore.getState().resetAll()
};
