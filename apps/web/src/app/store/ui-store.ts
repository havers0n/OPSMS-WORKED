import { create } from 'zustand';

type UiState = {
  isDrawerCollapsed: boolean;
  activeSiteId: string | null;
  activeFloorId: string | null;
  toggleDrawer: () => void;
  setActiveSiteId: (siteId: string | null) => void;
  setActiveFloorId: (floorId: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isDrawerCollapsed: false,
  activeSiteId: null,
  activeFloorId: null,
  toggleDrawer: () => set((state) => ({ isDrawerCollapsed: !state.isDrawerCollapsed })),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId, activeFloorId: null }),
  setActiveFloorId: (activeFloorId) => set({ activeFloorId })
}));
