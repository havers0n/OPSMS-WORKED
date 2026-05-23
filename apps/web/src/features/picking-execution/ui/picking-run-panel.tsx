import { useEffect, useMemo } from 'react';
import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import { getRouteStepId } from '@/entities/picking-planning/model/route-steps';
import { usePickingRunStore } from '../model/picking-run-store';
import { PickingStepCard } from './picking-step-card';

export function PickingRunPanel({
  packageId,
  displayedSteps,
  onFocusCell
}: {
  packageId: string;
  displayedSteps: PlanningRouteStepDto[];
  onFocusCell: (cellId: string | null) => void;
}) {
  const {
    activePackageId,
    orderedStepIds,
    activeStepIndex,
    status,
    startRun,
    confirmCurrentStep,
    setFocusedLocation,
    focusedLocationId: _focusedLocationId
  } = usePickingRunStore();

  useEffect(() => {
    const stepIds = displayedSteps.map(getRouteStepId);
    if (
      activePackageId !== packageId ||
      orderedStepIds.length !== stepIds.length ||
      orderedStepIds.some((stepId, index) => stepId !== stepIds[index])
    ) {
      startRun(packageId, stepIds);
    }
  }, [activePackageId, displayedSteps, orderedStepIds, packageId, startRun]);

  const currentStep = useMemo(
    () => displayedSteps[activeStepIndex] ?? null,
    [activeStepIndex, displayedSteps]
  );

  if (!currentStep || status === 'completed') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" data-testid="picking-run-completed">
        Picking run completed.
      </div>
    );
  }

  return (
    <PickingStepCard
      step={currentStep}
      progressCurrent={displayedSteps.length === 0 ? 0 : activeStepIndex + 1}
      progressTotal={displayedSteps.length}
      onConfirm={confirmCurrentStep}
      onWhereIsIt={() => {
        setFocusedLocation(currentStep.locationId ?? currentStep.fromLocationId ?? null);
        onFocusCell(currentStep.cellId ?? null);
      }}
    />
  );
}
