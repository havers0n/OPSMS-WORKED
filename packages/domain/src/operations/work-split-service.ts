import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import { createPlanningWarning, warningMessages, type PlanningWarning, type PlanningWarningCode } from './planning-warning';
import { planWorkPackage, type WorkPackageDraft } from './work-package-planner';
import {
  estimateWorkloadComplexity,
  type WorkloadComplexityInput,
  type WorkloadComplexityLocationRef
} from './workload-complexity';

const UNKNOWN_GROUP_KEY = '__unknown__';

export type WorkSplitReason =
  | 'none'
  | 'max_zones'
  | 'max_pick_lines'
  | 'max_weight'
  | 'max_volume'
  | 'max_unique_locations';

export type WorkSplitInput = {
  package: WorkPackageDraft;
  locationsById?: WorkloadComplexityInput['locationsById'];
};

export type WorkSplitResult = {
  wasSplit: boolean;
  reason: WorkSplitReason;
  packages: WorkPackageDraft[];
  warnings: string[];
  warningDetails: PlanningWarning[];
};

function resolveStrategy(workPackage: WorkPackageDraft): PickingStrategy {
  return workPackage.strategy ?? getDefaultPickingStrategy(workPackage.method);
}

function getZoneId(location?: WorkloadComplexityLocationRef): string | undefined {
  return location?.taskZoneId ?? location?.pickZoneId ?? location?.zoneId ?? location?.allocationZoneId;
}

export function shouldSplitWorkPackage(input: WorkSplitInput): WorkSplitReason {
  const strategy = resolveStrategy(input.package);
  const complexity = estimateWorkloadComplexity({
    tasks: input.package.tasks,
    strategy,
    locationsById: input.locationsById
  });

  if (complexity.exceeds.maxZones) {
    return 'max_zones';
  }
  if (complexity.exceeds.maxUniqueLocations) {
    return 'max_unique_locations';
  }
  if (complexity.exceeds.maxWeightKg) {
    return 'max_weight';
  }
  if (complexity.exceeds.maxVolumeLiters) {
    return 'max_volume';
  }
  if (complexity.exceeds.maxPickLines) {
    return 'max_pick_lines';
  }

  return 'none';
}

export function groupTasksByZone(
  tasks: PickTaskCandidate[],
  locationsById?: WorkloadComplexityInput['locationsById']
): Record<string, PickTaskCandidate[]> {
  const groups: Record<string, PickTaskCandidate[]> = {};

  for (const task of tasks) {
    const zoneId = getZoneId(locationsById?.[task.fromLocationId]) ?? UNKNOWN_GROUP_KEY;
    groups[zoneId] ??= [];
    groups[zoneId].push(task);
  }

  return groups;
}

export function groupTasksByAisle(
  tasks: PickTaskCandidate[],
  locationsById?: WorkloadComplexityInput['locationsById']
): Record<string, PickTaskCandidate[]> {
  const groups: Record<string, PickTaskCandidate[]> = {};

  for (const task of tasks) {
    const aisleId = locationsById?.[task.fromLocationId]?.accessAisleId ?? UNKNOWN_GROUP_KEY;
    groups[aisleId] ??= [];
    groups[aisleId].push(task);
  }

  return groups;
}

function groupTasksByLocation(
  tasks: PickTaskCandidate[],
  locationsById?: WorkloadComplexityInput['locationsById']
): Record<string, PickTaskCandidate[]> {
  const groups: Record<string, PickTaskCandidate[]> = {};

  for (const task of tasks) {
    const hasLocation = Boolean(task.fromLocationId) && Boolean(locationsById?.[task.fromLocationId]);
    const locationGroup = hasLocation ? task.fromLocationId : UNKNOWN_GROUP_KEY;
    groups[locationGroup] ??= [];
    groups[locationGroup].push(task);
  }

  return groups;
}

export function chunkTasksByLineCount(tasks: PickTaskCandidate[], maxPickLines: number): PickTaskCandidate[][] {
  if (maxPickLines <= 0) {
    return [tasks];
  }

  const chunks: PickTaskCandidate[][] = [];
  for (let start = 0; start < tasks.length; start += maxPickLines) {
    chunks.push(tasks.slice(start, start + maxPickLines));
  }

  return chunks;
}

export function chunkTasksByWeight(tasks: PickTaskCandidate[], maxWeightKg: number): PickTaskCandidate[][] {
  if (maxWeightKg <= 0 || tasks.length === 0) {
    return [tasks];
  }

  const chunks: PickTaskCandidate[][] = [];
  let currentChunk: PickTaskCandidate[] = [];
  let currentWeight = 0;

  for (const task of tasks) {
    const taskWeight = typeof task.weightKg === 'number' ? task.weightKg : 0;

    if (currentChunk.length > 0 && currentWeight + taskWeight > maxWeightKg) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentWeight = 0;
    }

    currentChunk.push(task);
    currentWeight += taskWeight;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function chunkTasksByVolume(tasks: PickTaskCandidate[], maxVolumeLiters: number): PickTaskCandidate[][] {
  if (maxVolumeLiters <= 0 || tasks.length === 0) {
    return [tasks];
  }

  const chunks: PickTaskCandidate[][] = [];
  let currentChunk: PickTaskCandidate[] = [];
  let currentVolume = 0;

  for (const task of tasks) {
    const taskVolume = typeof task.volumeLiters === 'number' ? task.volumeLiters : 0;

    if (currentChunk.length > 0 && currentVolume + taskVolume > maxVolumeLiters) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentVolume = 0;
    }

    currentChunk.push(task);
    currentVolume += taskVolume;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildChildrenFromGroups(
  workPackage: WorkPackageDraft,
  groups: Array<{ key: string; tasks: PickTaskCandidate[] }>,
  splitReason: WorkSplitReason,
  locationsById?: WorkloadComplexityInput['locationsById']
): WorkSplitResult {
  const strategy = resolveStrategy(workPackage);

  const childPackages = groups.map((group, index) =>
    planWorkPackage({
      id: `${workPackage.id}-part-${index + 1}`,
      code: `${workPackage.code ?? workPackage.id}-P${index + 1}`,
      tasks: group.tasks,
      strategy,
      locationsById,
      assignedPickerId: workPackage.assignedPickerId,
      assignedZoneId: splitReason === 'max_zones' && group.key !== UNKNOWN_GROUP_KEY ? group.key : undefined
    })
  );

  const reasonText: Record<Exclude<WorkSplitReason, 'none'>, string> = {
    max_zones: 'zone',
    max_unique_locations: 'aisle/location',
    max_weight: 'weight',
    max_volume: 'volume',
    max_pick_lines: 'pick lines'
  };
  const reasonCode: Record<Exclude<WorkSplitReason, 'none'>, PlanningWarningCode> = {
    max_zones: 'WORK_PACKAGE_SPLIT_BY_ZONE',
    max_unique_locations: 'WORK_PACKAGE_SPLIT_BY_AISLE_OR_LOCATION',
    max_weight: 'WORK_PACKAGE_SPLIT_BY_WEIGHT',
    max_volume: 'WORK_PACKAGE_SPLIT_BY_VOLUME',
    max_pick_lines: 'WORK_PACKAGE_SPLIT_BY_PICK_LINES'
  };

  const splitMessage = `Work package split by ${reasonText[splitReason as Exclude<WorkSplitReason, 'none'>]}.`;
  const warningDetails = [
    createPlanningWarning(reasonCode[splitReason as Exclude<WorkSplitReason, 'none'>], splitMessage, { source: 'split' })
  ];
  for (const child of childPackages) {
    warningDetails.push(...child.warningDetails);
  }
  const warnings = warningMessages(warningDetails);

  return {
    wasSplit: true,
    reason: splitReason,
    packages: childPackages,
    warnings,
    warningDetails
  };
}

export function splitWorkPackage(input: WorkSplitInput): WorkSplitResult {
  if (input.package.tasks.length === 0) {
    return {
      wasSplit: false,
      reason: 'none',
      packages: [input.package],
      warnings: ['Work package is empty and was not split.'],
      warningDetails: [
        createPlanningWarning('EMPTY_WORKLOAD', 'Work package is empty and was not split.', { source: 'split' })
      ]
    };
  }

  const reason = shouldSplitWorkPackage(input);
  const strategy = resolveStrategy(input.package);

  if (reason === 'none') {
    return {
      wasSplit: false,
      reason,
      packages: [input.package],
      warnings: [],
      warningDetails: []
    };
  }

  if (reason === 'max_zones') {
    const grouped = groupTasksByZone(input.package.tasks, input.locationsById);
    const groups = Object.entries(grouped).map(([key, tasks]) => ({ key, tasks }));
    return buildChildrenFromGroups(input.package, groups, reason, input.locationsById);
  }

  if (reason === 'max_unique_locations') {
    const hasAnyAisle = input.package.tasks.some((task) => Boolean(input.locationsById?.[task.fromLocationId]?.accessAisleId));
    const grouped = hasAnyAisle
      ? groupTasksByAisle(input.package.tasks, input.locationsById)
      : groupTasksByLocation(input.package.tasks, input.locationsById);
    const groups = Object.entries(grouped).map(([key, tasks]) => ({ key, tasks }));
    return buildChildrenFromGroups(input.package, groups, reason, input.locationsById);
  }

  if (reason === 'max_weight') {
    const maxWeightKg = strategy.splitPolicy.maxWeightKg ?? Number.MAX_SAFE_INTEGER;
    const groups = chunkTasksByWeight(input.package.tasks, maxWeightKg).map((tasks, index) => ({
      key: String(index),
      tasks
    }));
    return buildChildrenFromGroups(input.package, groups, reason, input.locationsById);
  }

  if (reason === 'max_volume') {
    const maxVolumeLiters = strategy.splitPolicy.maxVolumeLiters ?? Number.MAX_SAFE_INTEGER;
    const groups = chunkTasksByVolume(input.package.tasks, maxVolumeLiters).map((tasks, index) => ({
      key: String(index),
      tasks
    }));
    return buildChildrenFromGroups(input.package, groups, reason, input.locationsById);
  }

  const maxPickLines = strategy.splitPolicy.maxPickLines ?? Number.MAX_SAFE_INTEGER;
  const groups = chunkTasksByLineCount(input.package.tasks, maxPickLines).map((tasks, index) => ({
    key: String(index),
    tasks
  }));

  return buildChildrenFromGroups(input.package, groups, reason, input.locationsById);
}
