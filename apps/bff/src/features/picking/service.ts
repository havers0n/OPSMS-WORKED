import type { SupabaseClient } from '@supabase/supabase-js';
import { createPickingRepo, type AllocationResult, type PickingRepo } from './repo.js';

export type AllocatePickStepsCommand = {
  taskId: string;
};

export type PickingService = {
  allocatePickSteps(command: AllocatePickStepsCommand): Promise<AllocationResult>;
};

export function createPickingServiceFromRepo(repo: PickingRepo): PickingService {
  return {
    allocatePickSteps: (command) => repo.allocatePickSteps(command.taskId)
  };
}

export function createPickingService(supabase: SupabaseClient): PickingService {
  return createPickingServiceFromRepo(createPickingRepo(supabase));
}
