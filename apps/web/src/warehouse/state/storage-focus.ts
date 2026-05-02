import {
  useStorageFocusStore,
  type StorageFocusStore
} from '@/warehouse/editor/model/v2/storage-focus-store';

export type WarehouseStorageFocus = Pick<
  StorageFocusStore,
  'selectedCellId' | 'selectedRackId' | 'activeLevel'
>;

export function useWarehouseStorageFocus<T>(selector: (state: StorageFocusStore) => T): T {
  return useStorageFocusStore(selector);
}

export const warehouseStorageFocusActions = {
  selectCell: (params: Parameters<StorageFocusStore['selectCell']>[0]) =>
    useStorageFocusStore.getState().selectCell(params),
  selectRack: (params: Parameters<StorageFocusStore['selectRack']>[0]) =>
    useStorageFocusStore.getState().selectRack(params),
  setActiveLevel: (level: number) => useStorageFocusStore.getState().setActiveLevel(level),
  clearCell: () => useStorageFocusStore.getState().clearCell(),
  clearAllFocus: () => useStorageFocusStore.getState().clearAllFocus(),
  handleEmptyCanvasClick: () => useStorageFocusStore.getState().handleEmptyCanvasClick()
};
