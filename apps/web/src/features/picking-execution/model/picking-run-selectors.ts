import { usePickingRunStore } from './picking-run-store';

export const useActiveStepId = () =>
  usePickingRunStore((state) => state.orderedStepIds[state.activeStepIndex] ?? null);

export const usePickingRunProgress = () =>
  usePickingRunStore((state) => ({
    current: state.orderedStepIds.length === 0 ? 0 : state.activeStepIndex + 1,
    total: state.orderedStepIds.length
  }));
