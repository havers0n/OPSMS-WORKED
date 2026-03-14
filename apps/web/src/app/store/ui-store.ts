import { create } from 'zustand';

type UiState = {
  isDrawerCollapsed: boolean;
  activeSiteId: string | null;
  activeFloorId: string | null;
  toggleDrawer: () => void;
  setActiveSiteId: (siteId: string | null) => void;
  setActiveFloorId: (floorId: string | null) => void;
};

const initialUiState = {
  isDrawerCollapsed: true,
  activeSiteId: null,
  activeFloorId: null
} satisfies Pick<UiState, 'isDrawerCollapsed' | 'activeSiteId' | 'activeFloorId'>;

export const useUiStore = create<UiState>((set) => ({
  ...initialUiState,
  toggleDrawer: () => set((state) => ({ isDrawerCollapsed: !state.isDrawerCollapsed })),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId, activeFloorId: null }),
  setActiveFloorId: (activeFloorId) => set({ activeFloorId })
}));

export function resetUiStore() {
  useUiStore.setState(initialUiState);
}
