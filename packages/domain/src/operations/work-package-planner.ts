import type { PickTaskCandidate, PickingMethod, PickingStrategy, WorkPackage } from './picking-planning';
import { createPlanningWarning, warningMessages, type PlanningWarning } from './planning-warning';
import { getDefaultPickingStrategy } from './picking-strategies';
import {
  estimateWorkloadComplexity,
  type WorkloadComplexityInput,
  type WorkloadComplexityScore
} from './workload-complexity';

export type WorkPackagePlanningInput = {
  tasks: PickTaskCandidate[];
  strategy?: PickingStrategy;
  strategyMethod?: PickingMethod;
  locationsById?: WorkloadComplexityInput['locationsById'];
  assignedPickerId?: string;
  assignedZoneId?: string;
  assignedCartId?: string;
  id?: string;
  code?: string;
};

export type WorkPackageDraft = WorkPackage & {
  code?: string;
  strategy: PickingStrategy;
  complexity: WorkloadComplexityScore;
  warnings: string[];
  warningDetails: PlanningWarning[];
  metadata: {
    generatedAt?: string;
    source: 'domain_planner';
    taskCount: number;
    orderCount: number;
    uniqueSkuCount: number;
    uniqueLocationCount: number;
    uniqueZoneCount: number;
    uniqueAisleCount: number;
  };
};

export function collectOrderIdsFromTasks(tasks: PickTaskCandidate[]): string[] {
  const orderIds = new Set<string>();

  for (const task of tasks) {
    for (const orderRef of task.orderRefs) {
      orderIds.add(orderRef.orderId);
    }
  }

  return [...orderIds];
}

export function countOrdersInTasks(tasks: PickTaskCandidate[]): number {
  return collectOrderIdsFromTasks(tasks).length;
}

export function createWorkPackageCode(method: PickingMethod, taskCount: number): string {
  return `WP-${method.toUpperCase()}-${taskCount}`;
}

function createWorkPackageId(strategy: PickingStrategy, complexity: WorkloadComplexityScore): string {
  return `wp-${strategy.method}-${complexity.pickLines}-${complexity.uniqueLocationCount}`;
}

function estimatePlanningTimeSec(complexity: WorkloadComplexityScore): number {
  return complexity.pickLines * 45 + complexity.uniqueLocationCount * 30 + complexity.uniqueZoneCount * 120;
}

export function planWorkPackage(input: WorkPackagePlanningInput): WorkPackageDraft {
  const strategy =
    input.strategy ??
    (input.strategyMethod ? getDefaultPickingStrategy(input.strategyMethod) : getDefaultPickingStrategy());

  const complexity = estimateWorkloadComplexity({
    tasks: input.tasks,
    strategy,
    locationsById: input.locationsById
  });

  const orderCount = countOrdersInTasks(input.tasks);
  const warningDetails = [...complexity.warningDetails];

  if (input.tasks.length === 0) {
    warningDetails.push(createPlanningWarning('EMPTY_WORKLOAD', 'WorkPackage has no tasks.', { source: 'domain' }));
  }

  if (strategy.requiresCartSlots && !input.assignedCartId) {
    warningDetails.push(createPlanningWarning('CART_REQUIRED_FOR_CLUSTER', 'Strategy requires cart slots but no assigned cart is provided.', { source: 'domain' }));
  }

  if (strategy.requiresPostSort) {
    warningDetails.push(createPlanningWarning('POST_SORT_REQUIRED', 'Strategy requires post-sort.', { severity: 'info', source: 'domain' }));
  }

  if (!strategy.preserveOrderSeparation && orderCount > 1) {
    warningDetails.push(createPlanningWarning('ORDER_SEPARATION_NOT_PRESERVED', 'Strategy may mix multiple orders in one WorkPackage.', { source: 'domain' }));
  }
  const warnings = warningMessages(warningDetails);

  return {
    id: input.id ?? createWorkPackageId(strategy, complexity),
    code: input.code ?? createWorkPackageCode(strategy.method, input.tasks.length),
    strategyId: strategy.id,
    strategy,
    method: strategy.method,
    tasks: input.tasks,
    assignedPickerId: input.assignedPickerId,
    assignedZoneId: input.assignedZoneId,
    assignedCartId: input.assignedCartId,
    totalWeightKg: complexity.totalWeightKg,
    totalVolumeLiters: complexity.totalVolumeLiters,
    estimatedTimeSec: estimatePlanningTimeSec(complexity),
    complexityScore: complexity.score,
    complexity,
    warnings,
    warningDetails,
    metadata: {
      source: 'domain_planner',
      taskCount: complexity.pickLines,
      orderCount,
      uniqueSkuCount: complexity.uniqueSkuCount,
      uniqueLocationCount: complexity.uniqueLocationCount,
      uniqueZoneCount: complexity.uniqueZoneCount,
      uniqueAisleCount: complexity.uniqueAisleCount
    }
  };
}
