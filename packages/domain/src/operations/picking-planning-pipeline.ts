import type {
  PickTaskCandidate,
  PickingMethod,
  PickingStrategy,
  StorageLocationProjection
} from './picking-planning';
import { dedupePlanningWarnings, warningMessages, type PlanningWarning } from './planning-warning';
import { getDefaultPickingStrategy } from './picking-strategies';
import {
  sequenceWorkPackageRoute,
  type RouteSequenceMode,
  type RouteSequencerResult
} from './route-sequencer';
import { splitWorkPackage, type WorkSplitReason, type WorkSplitResult } from './work-split-service';
import { planWorkPackage, type WorkPackageDraft } from './work-package-planner';

type PickingPlanningLocationRef = Pick<StorageLocationProjection, 'id'> &
  Partial<
    Pick<
      StorageLocationProjection,
      | 'addressLabel'
      | 'zoneId'
      | 'pickZoneId'
      | 'taskZoneId'
      | 'allocationZoneId'
      | 'routeSequence'
      | 'pickSequence'
      | 'accessAisleId'
      | 'sideOfAisle'
      | 'positionAlongAisle'
      | 'travelNodeId'
      | 'x'
      | 'y'
    >
  >;

export type PickingPlanningInput = {
  tasks: PickTaskCandidate[];
  strategy?: PickingStrategy;
  strategyMethod?: PickingMethod;
  locationsById?: Record<string, PickingPlanningLocationRef>;
  assignedPickerId?: string;
  assignedZoneId?: string;
  assignedCartId?: string;
  id?: string;
  code?: string;
  routeMode?: RouteSequenceMode;
};

export type PlannedRoutePackage = {
  package: WorkPackageDraft;
  route: RouteSequencerResult;
};

export type PickingPlanningResult = {
  strategy: PickingStrategy;
  rootPackage: WorkPackageDraft;
  split: WorkSplitResult;
  packages: PlannedRoutePackage[];
  warnings: string[];
  warningDetails: PlanningWarning[];
  metadata: {
    packageCount: number;
    routeStepCount: number;
    taskCount: number;
    wasSplit: boolean;
    splitReason: WorkSplitReason;
  };
};

export function dedupeWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const uniqueWarnings: string[] = [];

  for (const warning of warnings) {
    if (!seen.has(warning)) {
      seen.add(warning);
      uniqueWarnings.push(warning);
    }
  }

  return uniqueWarnings;
}

export function collectPlanningWarnings(
  rootPackage: WorkPackageDraft,
  split: WorkSplitResult,
  packages: PlannedRoutePackage[]
): string[] {
  const combinedWarnings: string[] = [];

  combinedWarnings.push(...rootPackage.warnings);
  combinedWarnings.push(...split.warnings);

  for (const plannedPackage of packages) {
    combinedWarnings.push(...plannedPackage.package.warnings);
    combinedWarnings.push(...plannedPackage.route.warnings);
  }

  return dedupeWarnings(combinedWarnings);
}

export function collectPlanningWarningDetails(
  rootPackage: WorkPackageDraft,
  split: WorkSplitResult,
  packages: PlannedRoutePackage[]
): PlanningWarning[] {
  const combinedWarnings: PlanningWarning[] = [];

  combinedWarnings.push(...rootPackage.warningDetails);
  combinedWarnings.push(...split.warningDetails);

  for (const plannedPackage of packages) {
    combinedWarnings.push(...plannedPackage.package.warningDetails);
    combinedWarnings.push(...plannedPackage.route.warningDetails);
  }

  return dedupePlanningWarnings(combinedWarnings);
}

export function planPickingWork(input: PickingPlanningInput): PickingPlanningResult {
  const strategy =
    input.strategy ??
    (input.strategyMethod ? getDefaultPickingStrategy(input.strategyMethod) : getDefaultPickingStrategy());

  const rootPackage = planWorkPackage({
    tasks: input.tasks,
    strategy,
    locationsById: input.locationsById,
    assignedPickerId: input.assignedPickerId,
    assignedZoneId: input.assignedZoneId,
    assignedCartId: input.assignedCartId,
    id: input.id,
    code: input.code
  });

  const split = splitWorkPackage({
    package: rootPackage,
    locationsById: input.locationsById
  });

  const packages = split.packages.map((workPackage) => ({
    package: workPackage,
    route: sequenceWorkPackageRoute({
      package: workPackage,
      locationsById: input.locationsById,
      mode: input.routeMode ?? workPackage.strategy.routePriorityMode
    })
  }));

  const warningDetails = collectPlanningWarningDetails(rootPackage, split, packages);
  const warnings = warningMessages(warningDetails);

  return {
    strategy,
    rootPackage,
    split,
    packages,
    warnings,
    warningDetails,
    metadata: {
      packageCount: packages.length,
      routeStepCount: packages.reduce((sum, plannedPackage) => sum + plannedPackage.route.steps.length, 0),
      taskCount: input.tasks.length,
      wasSplit: split.wasSplit,
      splitReason: split.reason
    }
  };
}
