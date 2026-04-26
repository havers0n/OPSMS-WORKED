import type { PickTaskCandidate } from '@wos/domain';
import type { UnresolvedPlanningLine } from './input-builder.js';

export type UnresolvedPlanningLineSummary = {
  total: number;
  byReason: Record<string, number>;
};

export type PlanningCoverage = {
  orderCount: number;
  orderLineCount: number;
  plannedLineCount: number;
  unresolvedLineCount: number;
  plannedQty: number;
  unresolvedQty: number;
  planningCoveragePct: number;
};

export function summarizeUnresolvedPlanningLines(
  unresolved: UnresolvedPlanningLine[]
): UnresolvedPlanningLineSummary {
  const byReason: Record<string, number> = {};

  for (const line of unresolved) {
    byReason[line.reason] = (byReason[line.reason] ?? 0) + 1;
  }

  return {
    total: unresolved.length,
    byReason
  };
}

export function calculatePlanningCoverage(input: {
  orderIds: string[];
  tasks: PickTaskCandidate[];
  unresolved: UnresolvedPlanningLine[];
}): PlanningCoverage {
  const plannedLineCount = input.tasks.length;
  const unresolvedLineCount = input.unresolved.length;
  const orderLineCount = plannedLineCount + unresolvedLineCount;

  const plannedQty = input.tasks.reduce((sum, task) => sum + task.qty, 0);
  const unresolvedQty = input.unresolved.reduce((sum, line) => sum + line.qty, 0);

  return {
    orderCount: input.orderIds.length,
    orderLineCount,
    plannedLineCount,
    unresolvedLineCount,
    plannedQty,
    unresolvedQty,
    planningCoveragePct: orderLineCount === 0 ? 100 : (plannedLineCount / orderLineCount) * 100
  };
}
