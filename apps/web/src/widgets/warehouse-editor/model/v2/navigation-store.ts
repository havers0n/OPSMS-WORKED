import { create } from 'zustand'

export type NavigationStore = {
  rackId: string | null
  activeLevel: number | null
  // Actions
  setRack: (rackId: string) => void
  setLevel: (level: number) => void
  clearNavigation: () => void
}

const initialState = {
  rackId: null,
  activeLevel: null,
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  ...initialState,
  setRack: (rackId: string) => set({ rackId }),
  setLevel: (level: number) => set({ activeLevel: level }),
  clearNavigation: () => set({ rackId: null, activeLevel: null }),
}))

export function resetNavigationStore() {
  useNavigationStore.setState({
    rackId: null,
    activeLevel: null,
  })
}
