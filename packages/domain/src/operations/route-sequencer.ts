import type { PickTaskCandidate, RoutePriorityMode, RouteStep, StorageLocationProjection } from './picking-planning';
import { createPlanningWarning, warningMessages, type PlanningWarning } from './planning-warning';
import type { WorkPackageDraft } from './work-package-planner';

export type RouteSequenceMode = RoutePriorityMode;

type RouteSequencerLocationRef = Pick<StorageLocationProjection, 'id'> &
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

export type RouteSequencerInput = {
  package: WorkPackageDraft;
  locationsById?: Record<string, RouteSequencerLocationRef>;
  mode?: RouteSequenceMode;
};

export type RouteSequencerResult = {
  steps: RouteStep[];
  warnings: string[];
  warningDetails: PlanningWarning[];
  metadata: {
    mode: RouteSequenceMode;
    taskCount: number;
    sequencedCount: number;
    unknownLocationCount: number;
  };
};

type SequencingCandidate = {
  task: PickTaskCandidate;
  location?: RouteSequencerLocationRef;
  unknownLocation: boolean;
  zoneKey: string;
  handlingRank: number;
  stableIndex: number;
};

const UNKNOWN_TEXT = '~~~unknown~~~';

function textKey(value?: string): string {
  return value ?? UNKNOWN_TEXT;
}

function numberKey(value?: number): number {
  return value ?? Number.MAX_SAFE_INTEGER;
}

function zoneKey(location?: RouteSequencerLocationRef): string {
  return textKey(location?.taskZoneId ?? location?.pickZoneId ?? location?.zoneId ?? location?.allocationZoneId);
}

function sideOfAisleKey(side?: 'left' | 'right'): number {
  if (side === 'left') {
    return 0;
  }
  if (side === 'right') {
    return 1;
  }
  return 2;
}

function compareValues<T extends string | number>(a: T, b: T): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function compareByKeys(keys: Array<[string | number, string | number]>): number {
  for (const [left, right] of keys) {
    const result = compareValues(left, right);
    if (result !== 0) {
      return result;
    }
  }
  return 0;
}

function handlingRank(task: PickTaskCandidate): number {
  switch (task.handlingClass) {
    case 'hazmat':
      return 0;
    case 'bulky':
    case 'heavy':
      return 1;
    case 'normal':
    case 'cold':
    case 'frozen':
    case undefined:
      return 2;
    case 'fragile':
      return 3;
    default:
      return 2;
  }
}

function handlingInstruction(task: PickTaskCandidate): string | undefined {
  switch (task.handlingClass) {
    case 'heavy':
      return 'Heavy item. Place low / at the bottom.';
    case 'bulky':
      return 'Bulky item. Confirm equipment or cart capacity.';
    case 'fragile':
      return 'Fragile item. Keep above heavy items.';
    case 'cold':
      return 'Cold item. Follow temperature handling flow.';
    case 'frozen':
      return 'Frozen item. Minimize time outside temperature zone.';
    case 'hazmat':
      return 'Hazmat item. Follow special handling procedure.';
    default:
      return undefined;
  }
}

function comparator(mode: RouteSequenceMode): (left: SequencingCandidate, right: SequencingCandidate) => number {
  return (left, right) => {
    const unknownOrder = Number(left.unknownLocation) - Number(right.unknownLocation);
    if (unknownOrder !== 0) {
      return unknownOrder;
    }

    if (mode === 'address_sequence') {
      return compareByKeys([
        [textKey(left.location?.addressLabel), textKey(right.location?.addressLabel)],
        [numberKey(left.location?.routeSequence), numberKey(right.location?.routeSequence)],
        [left.task.id, right.task.id],
        [left.stableIndex, right.stableIndex]
      ]);
    }

    if (mode === 'handling') {
      return compareByKeys([
        [left.handlingRank, right.handlingRank],
        [left.zoneKey, right.zoneKey],
        [numberKey(left.location?.routeSequence), numberKey(right.location?.routeSequence)],
        [textKey(left.location?.addressLabel), textKey(right.location?.addressLabel)],
        [left.task.id, right.task.id],
        [left.stableIndex, right.stableIndex]
      ]);
    }

    if (mode === 'location_sequence') {
      return compareByKeys([
        [left.zoneKey, right.zoneKey],
        [textKey(left.location?.accessAisleId), textKey(right.location?.accessAisleId)],
        [numberKey(left.location?.routeSequence), numberKey(right.location?.routeSequence)],
        [numberKey(left.location?.positionAlongAisle), numberKey(right.location?.positionAlongAisle)],
        [sideOfAisleKey(left.location?.sideOfAisle), sideOfAisleKey(right.location?.sideOfAisle)],
        [numberKey(left.location?.pickSequence), numberKey(right.location?.pickSequence)],
        [textKey(left.location?.addressLabel), textKey(right.location?.addressLabel)],
        [left.task.id, right.task.id],
        [left.stableIndex, right.stableIndex]
      ]);
    }

    return compareByKeys([
      [left.zoneKey, right.zoneKey],
      [textKey(left.location?.accessAisleId), textKey(right.location?.accessAisleId)],
      [numberKey(left.location?.positionAlongAisle), numberKey(right.location?.positionAlongAisle)],
      [numberKey(left.location?.routeSequence), numberKey(right.location?.routeSequence)],
      [left.handlingRank, right.handlingRank],
      [textKey(left.location?.addressLabel), textKey(right.location?.addressLabel)],
      [left.task.id, right.task.id],
      [left.stableIndex, right.stableIndex]
    ]);
  };
}

export function sequenceWorkPackageRoute(input: RouteSequencerInput): RouteSequencerResult {
  const workPackage = input.package;
  const locationsById = input.locationsById ?? {};
  const warningDetails: PlanningWarning[] = [];

  const requestedMode = input.mode ?? workPackage.strategy.routePriorityMode ?? 'hybrid';
  const mode = requestedMode === 'distance' ? 'hybrid' : requestedMode;

  if (requestedMode === 'distance') {
    warningDetails.push(createPlanningWarning('DISTANCE_MODE_FALLBACK', 'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.', { severity: 'info', source: 'route' }));
  }

  if (workPackage.tasks.length === 0) {
    warningDetails.push(createPlanningWarning('EMPTY_WORKLOAD', 'Work package has no tasks.', { source: 'route' }));
  }

  const candidates: SequencingCandidate[] = workPackage.tasks.map((task, stableIndex) => {
    const location = locationsById[task.fromLocationId];

    return {
      task,
      location,
      unknownLocation: !location,
      zoneKey: zoneKey(location),
      handlingRank: handlingRank(task),
      stableIndex
    };
  });

  const unknownLocationCount = candidates.filter((candidate) => candidate.unknownLocation).length;
  if (unknownLocationCount > 0) {
    warningDetails.push(createPlanningWarning('UNKNOWN_SOURCE_LOCATION', `Some tasks have unknown source locations (${unknownLocationCount}). Unknown locations are sequenced last.`, { source: 'route', details: { count: unknownLocationCount } }));
  }

  if (candidates.some((candidate) => candidate.task.handlingClass === 'hazmat')) {
    warningDetails.push(createPlanningWarning('HAZMAT_PRESENT', 'Hazmat tasks are present. Follow special handling procedure and local safety policy.', { source: 'route' }));
  }

  const sequenced = [...candidates].sort(comparator(mode));

  const steps: RouteStep[] = sequenced.map((candidate, index) => ({
    sequence: index + 1,
    taskId: candidate.task.id,
    fromLocationId: candidate.task.fromLocationId,
    skuId: candidate.task.skuId,
    qtyToPick: candidate.task.qty,
    allocations: candidate.task.orderRefs.map((orderRef) => ({
      orderId: orderRef.orderId,
      orderLineId: orderRef.orderLineId,
      qty: orderRef.qty
    })),
    handlingInstruction: handlingInstruction(candidate.task)
  }));

  if (workPackage.strategy.requiresCartSlots && !steps.some((step) => step.allocations.some((allocation) => allocation.cartSlotId))) {
    warningDetails.push(createPlanningWarning('CART_REQUIRED_FOR_CLUSTER', 'Cluster strategy requires cart slots but no cart slot allocations exist yet.', { source: 'route' }));
  }
  const warnings = warningMessages(warningDetails);

  return {
    steps,
    warnings,
    warningDetails,
    metadata: {
      mode,
      taskCount: workPackage.tasks.length,
      sequencedCount: steps.length,
      unknownLocationCount
    }
  };
}
