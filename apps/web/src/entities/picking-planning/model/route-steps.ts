import type { PlanningPackageRouteDto, PlanningRouteStepDto } from './types';

export function getRouteStepId(step: PlanningRouteStepDto): string {
  return step.taskId || `${step.fromLocationId}:${step.sequence}`;
}

export function deriveDisplayedRouteSteps(
  steps: PlanningRouteStepDto[],
  reorderedStepIds: string[] | undefined
): PlanningRouteStepDto[] {
  if (!reorderedStepIds || reorderedStepIds.length === 0) {
    return steps;
  }

  const originalById = new Map(steps.map((step) => [getRouteStepId(step), step]));
  const displayed: PlanningRouteStepDto[] = [];
  const used = new Set<string>();

  for (const stepId of reorderedStepIds) {
    const step = originalById.get(stepId);
    if (!step || used.has(stepId)) continue;
    displayed.push(step);
    used.add(stepId);
  }

  for (const step of steps) {
    const stepId = getRouteStepId(step);
    if (!used.has(stepId)) {
      displayed.push(step);
    }
  }

  return displayed;
}

export function findPackageById(
  packages: PlanningPackageRouteDto[],
  packageId: string | null
) {
  return packages.find((pkg) => pkg.workPackage.id === packageId) ?? null;
}
