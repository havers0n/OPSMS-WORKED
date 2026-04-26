import { planPickingWork, type PickingPlanningInput, type PickingPlanningResult } from '@wos/domain';
import type { PickingPlanningPreviewRequest } from './schema.js';

export type PickingPlanningPreviewService = {
  previewPickingPlan(input: PickingPlanningPreviewRequest): PickingPlanningResult;
};

export function createPickingPlanningPreviewService(
  planner: (input: PickingPlanningInput) => PickingPlanningResult = planPickingWork
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
      })
  };
}
