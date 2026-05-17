import { create } from 'zustand';

const NAVIGATOR_COLLAPSED_KEY = 'wos:storage-navigator-collapsed';

function readNavigatorCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(NAVIGATOR_COLLAPSED_KEY);
    if (stored !== null) return stored === 'true';
    // Auto-collapse on first load for mobile viewports.
    // innerWidth === 0 indicates jsdom/test env — leave expanded.
    return window.innerWidth > 0 && window.innerWidth < 640;
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
  setNavigatorCollapsed: (value: boolean) => void;
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
  setNavigatorCollapsed: (value) => set((state) => {
    if (state.isNavigatorCollapsed === value) return state;
    try { window.localStorage.setItem(NAVIGATOR_COLLAPSED_KEY, String(value)); } catch { /* ignore */ }
    return { isNavigatorCollapsed: value };
  }),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId, activeFloorId: null }),
  setActiveFloorId: (activeFloorId) => set({ activeFloorId })
}));

export function resetUiStore() {
  useUiStore.setState(initialUiState);
}
