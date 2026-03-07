import { useUiStore } from '@/app/store/ui-store';

export const useActiveSiteId = () => useUiStore((state) => state.activeSiteId);
export const useActiveFloorId = () => useUiStore((state) => state.activeFloorId);
export const useSetActiveSiteId = () => useUiStore((state) => state.setActiveSiteId);
export const useSetActiveFloorId = () => useUiStore((state) => state.setActiveFloorId);
