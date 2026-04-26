import {
  createPlanningWarning,
  dedupePlanningWarnings,
  planPickingWork,
  type PickingPlanningInput,
  type PickingPlanningResult,
  type PlanningWarning
} from '@wos/domain';
import type {
  PickingPlanningPreviewOrdersRequest,
  PickingPlanningPreviewRequest,
  PickingPlanningPreviewWaveRequest
} from './schema.js';
import {
  buildPlanningInputFromOrders,
  type BuildPlanningInputFromOrdersResult,
  type PickingPlanningOrderInputReadRepo
} from './input-builder.js';
import {
  calculatePlanningCoverage,
  summarizeUnresolvedPlanningLines,
  type PlanningCoverage,
  type UnresolvedPlanningLineSummary
} from './diagnostics.js';
import type { PickingPlanningWaveReadRepo } from './repo.js';

export type PickingPlanningPreviewFromOrdersResult = {
  planning: PickingPlanningResult;
  orderIds: string[];
  unresolvedSummary: UnresolvedPlanningLineSummary;
  coverage: PlanningCoverage;
} & BuildPlanningInputFromOrdersResult;

export type PickingPlanningPreviewFromWaveResult = PickingPlanningPreviewFromOrdersResult & {
  waveId: string;
  orderIds: string[];
  unresolvedSummary: UnresolvedPlanningLineSummary;
  coverage: PlanningCoverage;
  warningDetails: PlanningWarning[];
};

export type PickingPlanningPreviewService = {
  previewPickingPlan(input: PickingPlanningPreviewRequest): PickingPlanningResult;
  previewPickingPlanFromOrders(input: PickingPlanningPreviewOrdersRequest): Promise<PickingPlanningPreviewFromOrdersResult>;
  previewPickingPlanFromWave(input: PickingPlanningPreviewWaveRequest): Promise<PickingPlanningPreviewFromWaveResult>;
};

export function createPickingPlanningPreviewService(
  planner: (input: PickingPlanningInput) => PickingPlanningResult = planPickingWork,
  inputReadRepo?: PickingPlanningOrderInputReadRepo,
  waveReadRepo?: PickingPlanningWaveReadRepo
): PickingPlanningPreviewService {
  const previewPickingPlanFromOrders = async (
    input: PickingPlanningPreviewOrdersRequest
  ): Promise<PickingPlanningPreviewFromOrdersResult> => {
    if (!inputReadRepo) {
      throw new Error('Picking planning order input repo is not configured.');
    }

    const built = await buildPlanningInputFromOrders(inputReadRepo, { orderIds: input.orderIds });
    const planning = planner({
      tasks: built.tasks,
      locationsById: built.locationsById,
      strategyMethod: input.strategyMethod,
      routeMode: input.routeMode,
      assignedPickerId: input.assignedPickerId,
      assignedZoneId: input.assignedZoneId,
      assignedCartId: input.assignedCartId,
      id: input.id,
      code: input.code
    });

    const unresolvedSummary = summarizeUnresolvedPlanningLines(built.unresolved);
    const coverage = calculatePlanningCoverage({ orderIds: input.orderIds, tasks: built.tasks, unresolved: built.unresolved });

    return {
      planning,
      orderIds: [...input.orderIds],
      unresolvedSummary,
      coverage,
      ...built
    };
  };

  return {
    previewPickingPlan: (input) =>
      planner({
        tasks: input.tasks,
        strategyMethod: input.strategyMethod,
        routeMode: input.routeMode,
        locationsById: input.locationsById,
        assignedPickerId: input.assignedPickerId,
        assignedZoneId: input.assignedZoneId,
        assignedCartId: input.assignedCartId,
        id: input.id,
        code: input.code
      }),

    previewPickingPlanFromOrders,

    previewPickingPlanFromWave: async (input) => {
      if (!waveReadRepo) {
        throw new Error('Picking planning wave repo is not configured.');
      }

      const orderIds = await waveReadRepo.listOrderIdsForWave(input.waveId);
      const fromOrders = await previewPickingPlanFromOrders({ ...input, orderIds });

      const warnings = new Set<string>(fromOrders.warnings);
      const warningDetails: PlanningWarning[] = [
        ...(fromOrders.warningDetails ?? []),
        ...(fromOrders.planning.warningDetails ?? [])
      ];
      for (const warning of fromOrders.planning.warnings) {
        warnings.add(warning);
      }
      if (orderIds.length === 0) {
        const message = 'Wave contains no orders.';
        warnings.add(message);
        warningDetails.push(createPlanningWarning('EMPTY_WAVE', message, { source: 'wave' }));
      }
      if (fromOrders.unresolved.length > 0) {
        const message = 'Unresolved planning lines are present in wave preview.';
        warnings.add(message);
        warningDetails.push(createPlanningWarning('UNRESOLVED_PLANNING_LINES_PRESENT', message, {
          source: 'wave',
          details: { count: fromOrders.unresolved.length }
        }));
      }

      return {
        waveId: input.waveId,
        orderIds,
        planning: fromOrders.planning,
        tasks: fromOrders.tasks,
        locationsById: fromOrders.locationsById,
        unresolved: fromOrders.unresolved,
        unresolvedSummary: fromOrders.unresolvedSummary,
        coverage: fromOrders.coverage,
        warnings: Array.from(warnings),
        warningDetails: dedupePlanningWarnings(warningDetails)
      };
    }
  };
}
