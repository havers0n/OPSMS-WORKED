import { create } from 'zustand'

export type SelectionStore = {
  locationId: string | null
  containerId: string | null
  // Actions
  selectLocation: (locationId: string) => void
  selectContainer: (containerId: string) => void
  clearSelection: () => void
}

const initialState = {
  locationId: null,
  containerId: null,
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  ...initialState,
  selectLocation: (locationId: string) => set({ locationId }),
  selectContainer: (containerId: string) => set({ containerId }),
  clearSelection: () => set({ locationId: null, containerId: null }),
}))

export function resetSelectionStore() {
  useSelectionStore.setState({
    locationId: null,
    containerId: null,
  })
}
