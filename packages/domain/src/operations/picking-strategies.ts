import type {
  PickingMethod,
  PickingStrategy,
  WorkSplitPolicy
} from './picking-planning';

export const PICKING_METHODS: readonly PickingMethod[] = [
  'single_order',
  'batch',
  'wave_bulk',
  'cluster',
  'zone',
  'pick_and_pack',
  'two_step'
] as const;

const DEFAULT_SPLIT_POLICY: Readonly<WorkSplitPolicy> = {
  maxPickLines: 25,
  maxEstimatedPickTimeSec: 45 * 60,
  maxWeightKg: 40,
  maxVolumeLiters: 350,
  maxUniqueLocations: 30,
  maxZones: 2
};

const PICK_AND_PACK_SPLIT_POLICY: Readonly<WorkSplitPolicy> = {
  ...DEFAULT_SPLIT_POLICY,
  maxWeightKg: 20,
  maxVolumeLiters: 180,
  maxUniqueLocations: 20,
  maxZones: 1
};

const WAVE_BULK_SPLIT_POLICY: Readonly<WorkSplitPolicy> = {
  ...DEFAULT_SPLIT_POLICY,
  maxPickLines: 40,
  maxUniqueLocations: 45,
  maxZones: 3
};

const CLUSTER_SPLIT_POLICY: Readonly<WorkSplitPolicy> = {
  ...DEFAULT_SPLIT_POLICY,
  maxPickLines: 20,
  maxUniqueLocations: 25
};

export const DEFAULT_PICKING_STRATEGY_METHOD: PickingMethod = 'single_order';

const INTERNAL_DEFAULT_PICKING_STRATEGIES: Readonly<Record<PickingMethod, PickingStrategy>> = {
  single_order: {
    id: 'default-single-order',
    code: 'DEFAULT_SINGLE_ORDER',
    name: 'Default Single Order',
    method: 'single_order',
    aggregateSameSku: false,
    preserveOrderSeparation: true,
    requiresCartSlots: false,
    requiresPostSort: false,
    routePriorityMode: 'hybrid',
    splitPolicy: DEFAULT_SPLIT_POLICY
  },
  batch: {
    id: 'default-batch',
    code: 'DEFAULT_BATCH',
    name: 'Default Batch',
    method: 'batch',
    aggregateSameSku: true,
    preserveOrderSeparation: false,
    requiresCartSlots: false,
    requiresPostSort: true,
    routePriorityMode: 'location_sequence',
    splitPolicy: DEFAULT_SPLIT_POLICY
  },
  wave_bulk: {
    id: 'default-wave-bulk',
    code: 'DEFAULT_WAVE_BULK',
    name: 'Default Wave Bulk',
    method: 'wave_bulk',
    aggregateSameSku: true,
    preserveOrderSeparation: false,
    requiresCartSlots: false,
    requiresPostSort: true,
    routePriorityMode: 'location_sequence',
    splitPolicy: WAVE_BULK_SPLIT_POLICY
  },
  cluster: {
    id: 'default-cluster',
    code: 'DEFAULT_CLUSTER',
    name: 'Default Cluster',
    method: 'cluster',
    aggregateSameSku: true,
    preserveOrderSeparation: true,
    requiresCartSlots: true,
    requiresPostSort: false,
    routePriorityMode: 'hybrid',
    splitPolicy: CLUSTER_SPLIT_POLICY
  },
  zone: {
    id: 'default-zone',
    code: 'DEFAULT_ZONE',
    name: 'Default Zone',
    method: 'zone',
    aggregateSameSku: true,
    preserveOrderSeparation: false,
    requiresCartSlots: false,
    requiresPostSort: true,
    routePriorityMode: 'location_sequence',
    splitPolicy: DEFAULT_SPLIT_POLICY
  },
  pick_and_pack: {
    id: 'default-pick-and-pack',
    code: 'DEFAULT_PICK_AND_PACK',
    name: 'Default Pick and Pack',
    method: 'pick_and_pack',
    aggregateSameSku: false,
    preserveOrderSeparation: true,
    requiresCartSlots: false,
    requiresPostSort: false,
    routePriorityMode: 'handling',
    splitPolicy: PICK_AND_PACK_SPLIT_POLICY
  },
  two_step: {
    id: 'default-two-step',
    code: 'DEFAULT_TWO_STEP',
    name: 'Default Two Step',
    method: 'two_step',
    aggregateSameSku: true,
    preserveOrderSeparation: false,
    requiresCartSlots: false,
    requiresPostSort: true,
    routePriorityMode: 'location_sequence',
    splitPolicy: DEFAULT_SPLIT_POLICY
  }
};

function cloneSplitPolicy(splitPolicy: WorkSplitPolicy): WorkSplitPolicy {
  return { ...splitPolicy };
}

function clonePickingStrategy(strategy: PickingStrategy): PickingStrategy {
  return {
    ...strategy,
    splitPolicy: cloneSplitPolicy(strategy.splitPolicy)
  };
}

export const DEFAULT_PICKING_STRATEGIES: Record<PickingMethod, PickingStrategy> =
  Object.fromEntries(
    PICKING_METHODS.map((method) => [method, clonePickingStrategy(INTERNAL_DEFAULT_PICKING_STRATEGIES[method])])
  ) as Record<PickingMethod, PickingStrategy>;

export function getDefaultPickingStrategy(method: PickingMethod = DEFAULT_PICKING_STRATEGY_METHOD): PickingStrategy {
  return clonePickingStrategy(INTERNAL_DEFAULT_PICKING_STRATEGIES[method]);
}

export function isPickingMethod(value: unknown): value is PickingMethod {
  return typeof value === 'string' && PICKING_METHODS.includes(value as PickingMethod);
}

export function isPostSortRequired(method: PickingMethod): boolean {
  return INTERNAL_DEFAULT_PICKING_STRATEGIES[method].requiresPostSort;
}

export function requiresCartSlots(method: PickingMethod): boolean {
  return INTERNAL_DEFAULT_PICKING_STRATEGIES[method].requiresCartSlots;
}
