import { create } from 'zustand';
import type { PickingRunStatus } from './picking-run-types';

type PickingRunState = {
  activePackageId: string | null;
  orderedStepIds: string[];
  activeStepIndex: number;
  pickedStepIds: string[];
  focusedLocationId: string | null;
  status: PickingRunStatus;
  startRun: (packageId: string, stepIds: string[]) => void;
  confirmCurrentStep: () => void;
  goNext: () => void;
  goPrevious: () => void;
  setFocusedLocation: (locationId: string | null) => void;
  resetRun: () => void;
};

const initialState = {
  activePackageId: null,
  orderedStepIds: [],
  activeStepIndex: 0,
  pickedStepIds: [],
  focusedLocationId: null,
  status: 'not_started' as PickingRunStatus
};

function clampIndex(index: number, stepCount: number) {
  if (stepCount <= 0) return 0;
  if (index < 0) return 0;
  if (index > stepCount - 1) return stepCount - 1;
  return index;
}

export const usePickingRunStore = create<PickingRunState>((set, get) => ({
  ...initialState,
  startRun: (packageId, stepIds) =>
    set({
      activePackageId: packageId,
      orderedStepIds: [...stepIds],
      activeStepIndex: 0,
      pickedStepIds: [],
      focusedLocationId: null,
      status: stepIds.length > 0 ? 'in_progress' : 'completed'
    }),
  confirmCurrentStep: () => {
    const state = get();
    if (state.status !== 'in_progress') return;
    const currentStepId = state.orderedStepIds[state.activeStepIndex];
    if (!currentStepId) return;

    const pickedSet = new Set(state.pickedStepIds);
    pickedSet.add(currentStepId);
    const nextPickedStepIds = Array.from(pickedSet);
    const isFinalStep = state.activeStepIndex >= state.orderedStepIds.length - 1;

    if (isFinalStep) {
      set({
        pickedStepIds: nextPickedStepIds,
        status: 'completed'
      });
      return;
    }

    set({
      pickedStepIds: nextPickedStepIds,
      activeStepIndex: state.activeStepIndex + 1
    });
  },
  goNext: () =>
    set((state) => {
      if (state.status === 'not_started') return state;
      const nextIndex = clampIndex(
        state.activeStepIndex + 1,
        state.orderedStepIds.length
      );
      return {
        ...state,
        activeStepIndex: nextIndex
      };
    }),
  goPrevious: () =>
    set((state) => {
      if (state.status === 'not_started') return state;
      const nextIndex = clampIndex(
        state.activeStepIndex - 1,
        state.orderedStepIds.length
      );
      return {
        ...state,
        activeStepIndex: nextIndex
      };
    }),
  setFocusedLocation: (locationId) => set({ focusedLocationId: locationId }),
  resetRun: () => set(initialState)
}));

export function resetPickingRunStore() {
  usePickingRunStore.setState(initialState);
}
