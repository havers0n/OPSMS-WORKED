import { create } from 'zustand';
import type {
  PickingPlanningOverlaySource,
  PickingPlanningPreviewResponse
} from './types';

export type PickingPlanningOverlayState = {
  source: PickingPlanningOverlaySource;
  preview: PickingPlanningPreviewResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  activePackageId: string | null;
  selectedStepId: string | null;
  reorderedStepIdsByPackageId: Record<string, string[]>;
  setSource: (source: PickingPlanningOverlaySource) => void;
  setPreview: (preview: PickingPlanningPreviewResponse | null) => void;
  setActivePackageId: (packageId: string | null) => void;
  setSelectedStepId: (stepId: string | null) => void;
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
  reorderedStepIdsByPackageId: {}
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
        reorderedStepIdsByPackageId: {}
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
          reorderedStepIdsByPackageId: {}
        };
      }),
    setActivePackageId: (activePackageId) =>
      set({ activePackageId, selectedStepId: null }),
    setSelectedStepId: (selectedStepId) => set({ selectedStepId }),
    reorderPackageSteps: (packageId, stepIds, stepId, direction) =>
      set((state) => {
        const current =
          state.reorderedStepIdsByPackageId[packageId] ?? stepIds;
        return {
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
