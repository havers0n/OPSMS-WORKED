import { planPickingWork, type PickingPlanningInput, type PickingPlanningResult } from '@wos/domain';
import type { PickingPlanningPreviewRequest, PickingPlanningPreviewOrdersRequest } from './schema.js';
import {
  buildPlanningInputFromOrders,
  type BuildPlanningInputFromOrdersResult,
  type PickingPlanningOrderInputReadRepo
} from './input-builder.js';

export type PickingPlanningPreviewService = {
  previewPickingPlan(input: PickingPlanningPreviewRequest): PickingPlanningResult;
  previewPickingPlanFromOrders(
    input: PickingPlanningPreviewOrdersRequest
  ): Promise<{ planning: PickingPlanningResult } & BuildPlanningInputFromOrdersResult>;
};

export function createPickingPlanningPreviewService(
  planner: (input: PickingPlanningInput) => PickingPlanningResult = planPickingWork,
  inputReadRepo?: PickingPlanningOrderInputReadRepo
): PickingPlanningPreviewService {
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

    previewPickingPlanFromOrders: async (input) => {
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

      return {
        planning,
        ...built
      };
    }
  };
}
