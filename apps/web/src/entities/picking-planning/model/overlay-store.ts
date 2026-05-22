import { create } from 'zustand';
import type {
  PickingPlanningOverlaySource,
  PickingPlanningPreviewResponse
} from './types';

export type PickingRouteOrderMode = 'original' | 'nearest-neighbor';
export type PickingRouteStartPoint = {
  x: number;
  y: number;
  source: 'manual';
};

export type PickingPlanningOverlayState = {
  source: PickingPlanningOverlaySource;
  preview: PickingPlanningPreviewResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  activePackageId: string | null;
  selectedStepId: string | null;
  reorderedStepIdsByPackageId: Record<string, string[]>;
  routeOrderModeByPackageId: Record<string, PickingRouteOrderMode>;
  routeStartPointByPackageId: Record<string, PickingRouteStartPoint>;
  placingRouteStartForPackageId: string | null;
  setSource: (source: PickingPlanningOverlaySource) => void;
  setPreview: (preview: PickingPlanningPreviewResponse | null) => void;
  setActivePackageId: (packageId: string | null) => void;
  setSelectedStepId: (stepId: string | null) => void;
  setRouteOrderMode: (packageId: string, mode: PickingRouteOrderMode) => void;
  setRouteStartPoint: (packageId: string, point: PickingRouteStartPoint) => void;
  clearRouteStartPoint: (packageId: string) => void;
  startPlacingRouteStartPoint: (packageId: string) => void;
  cancelPlacingRouteStartPoint: () => void;
  reorderPackageSteps: (
    packageId: string,
    stepIds: string[],
    stepId: string,
    direction: -1 | 1
  ) => void;
  resetReorder: (packageId?: string) => void;
};

const initialState = {
  source: { kind: 'none' } as PickingPlanningOverlaySource,
  preview: null,
  isLoading: false,
  errorMessage: null,
  activePackageId: null,
  selectedStepId: null,
  reorderedStepIdsByPackageId: {},
  routeOrderModeByPackageId: {},
  routeStartPointByPackageId: {},
  placingRouteStartForPackageId: null
};

function moveStepId(stepIds: string[], stepId: string, direction: -1 | 1) {
  const index = stepIds.indexOf(stepId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= stepIds.length) {
    return stepIds;
  }

  const next = [...stepIds];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return next;
}

export const usePickingPlanningOverlayStore =
  create<PickingPlanningOverlayState>((set) => ({
    ...initialState,
    setSource: (source) =>
      set({
        source,
        preview: null,
        isLoading: false,
        errorMessage: null,
        activePackageId: null,
        selectedStepId: null,
        reorderedStepIdsByPackageId: {},
        routeOrderModeByPackageId: {},
        routeStartPointByPackageId: {},
        placingRouteStartForPackageId: null
      }),
    setPreview: (preview) =>
      set((state) => {
        const firstPackageId = preview?.packages[0]?.workPackage.id ?? null;
        const activePackageStillExists =
          preview?.packages.some(
            (pkg) => pkg.workPackage.id === state.activePackageId
          ) ?? false;

        return {
          preview,
          isLoading: false,
          errorMessage: null,
          activePackageId: activePackageStillExists
            ? state.activePackageId
            : firstPackageId,
          selectedStepId: null,
          reorderedStepIdsByPackageId: {},
          routeOrderModeByPackageId: {},
          routeStartPointByPackageId: {},
          placingRouteStartForPackageId: null
        };
      }),
    setActivePackageId: (activePackageId) =>
      set({ activePackageId, selectedStepId: null }),
    setSelectedStepId: (selectedStepId) => set({ selectedStepId }),
    setRouteOrderMode: (packageId, mode) =>
      set((state) => {
        const nextRouteOrderModeByPackageId = {
          ...state.routeOrderModeByPackageId,
          [packageId]: mode
        };
        if (mode !== 'nearest-neighbor') {
          return { routeOrderModeByPackageId: nextRouteOrderModeByPackageId };
        }
        const nextReorderedStepIdsByPackageId = {
          ...state.reorderedStepIdsByPackageId
        };
        delete nextReorderedStepIdsByPackageId[packageId];
        return {
          routeOrderModeByPackageId: nextRouteOrderModeByPackageId,
          reorderedStepIdsByPackageId: nextReorderedStepIdsByPackageId
        };
      }),
    setRouteStartPoint: (packageId, point) =>
      set((state) => ({
        routeStartPointByPackageId: {
          ...state.routeStartPointByPackageId,
          [packageId]: point
        },
        placingRouteStartForPackageId:
          state.placingRouteStartForPackageId === packageId
            ? null
            : state.placingRouteStartForPackageId
      })),
    clearRouteStartPoint: (packageId) =>
      set((state) => {
        const next = { ...state.routeStartPointByPackageId };
        delete next[packageId];
        return { routeStartPointByPackageId: next };
      }),
    startPlacingRouteStartPoint: (packageId) =>
      set({ placingRouteStartForPackageId: packageId }),
    cancelPlacingRouteStartPoint: () =>
      set({ placingRouteStartForPackageId: null }),
    reorderPackageSteps: (packageId, stepIds, stepId, direction) =>
      set((state) => {
        const mode = state.routeOrderModeByPackageId[packageId] ?? 'original';
        const nextRouteOrderModeByPackageId =
          mode === 'nearest-neighbor'
            ? {
                ...state.routeOrderModeByPackageId,
                [packageId]: 'original' as const
              }
            : state.routeOrderModeByPackageId;
        const current =
          state.reorderedStepIdsByPackageId[packageId] ?? stepIds;
        return {
          routeOrderModeByPackageId: nextRouteOrderModeByPackageId,
          reorderedStepIdsByPackageId: {
            ...state.reorderedStepIdsByPackageId,
            [packageId]: moveStepId(current, stepId, direction)
          }
        };
      }),
    resetReorder: (packageId) =>
      set((state) => {
        if (!packageId) {
          return { reorderedStepIdsByPackageId: {} };
        }
        const next = { ...state.reorderedStepIdsByPackageId };
        delete next[packageId];
        return { reorderedStepIdsByPackageId: next };
      })
  }));

export function resetPickingPlanningOverlayStore() {
  usePickingPlanningOverlayStore.setState(initialState);
}
