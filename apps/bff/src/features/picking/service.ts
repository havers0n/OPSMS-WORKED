import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPickingRepo,
  type AllocationResult,
  type ExecutePickStepResult,
  type PickingRepo
} from './repo.js';

export type AllocatePickStepsCommand = {
  taskId: string;
};

export type ExecutePickStepCommand = {
  stepId: string;
  qtyActual: number;
  pickContainerId: string;
  actorId: string | null;
};

export type PickingService = {
  allocatePickSteps(command: AllocatePickStepsCommand): Promise<AllocationResult>;
  executePickStep(command: ExecutePickStepCommand): Promise<ExecutePickStepResult>;
};

export function createPickingServiceFromRepo(repo: PickingRepo): PickingService {
  return {
    allocatePickSteps: (command) => repo.allocatePickSteps(command.taskId),
    executePickStep: (command) =>
      repo.executePickStep(
        command.stepId,
        command.qtyActual,
        command.pickContainerId,
        command.actorId
      )
  };
}

export function createPickingService(supabase: SupabaseClient): PickingService {
  return createPickingServiceFromRepo(createPickingRepo(supabase));
}
