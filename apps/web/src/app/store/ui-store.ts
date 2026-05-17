import { create } from 'zustand';

const NAVIGATOR_COLLAPSED_KEY = 'wos:storage-navigator-collapsed';

function readNavigatorCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(NAVIGATOR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

type UiState = {
  isDrawerCollapsed: boolean;
  isNavigatorCollapsed: boolean;
  activeSiteId: string | null;
  activeFloorId: string | null;
  toggleDrawer: () => void;
  toggleNavigator: () => void;
  setActiveSiteId: (siteId: string | null) => void;
  setActiveFloorId: (floorId: string | null) => void;
};

const initialUiState = {
  isDrawerCollapsed: true,
  isNavigatorCollapsed: readNavigatorCollapsed(),
  activeSiteId: null,
  activeFloorId: null
} satisfies Pick<UiState, 'isDrawerCollapsed' | 'isNavigatorCollapsed' | 'activeSiteId' | 'activeFloorId'>;

export const useUiStore = create<UiState>((set) => ({
  ...initialUiState,
  toggleDrawer: () => set((state) => ({ isDrawerCollapsed: !state.isDrawerCollapsed })),
  toggleNavigator: () => set((state) => {
    const next = !state.isNavigatorCollapsed;
    try { window.localStorage.setItem(NAVIGATOR_COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
    return { isNavigatorCollapsed: next };
  }),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId, activeFloorId: null }),
  setActiveFloorId: (activeFloorId) => set({ activeFloorId })
}));

export function resetUiStore() {
  useUiStore.setState(initialUiState);
}
