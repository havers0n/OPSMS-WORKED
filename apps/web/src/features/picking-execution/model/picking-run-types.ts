import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';

export type PickInstructionFormatInput = {
  qtyEach: number | null | undefined;
  packagingLevels: PlanningRouteStepDto['packagingLevels'] | null | undefined;
};

export type PickInstructionFormatResult = {
  instruction: string;
  degraded: boolean;
  reason?:
    | 'ambiguous_packaging'
    | 'non_integer_quantity'
    | 'invalid_packaging_levels';
};

export type PickingRunStatus = 'not_started' | 'in_progress' | 'completed';
