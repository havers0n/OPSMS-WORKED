import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PickTaskNotFoundError } from './errors.js';

const allocationRpcResultSchema = z.object({
  taskId: z.string().uuid(),
  allocated: z.number().int().min(0),
  needsReplenishment: z.number().int().min(0)
});

export type AllocationResult = z.infer<typeof allocationRpcResultSchema>;

export type PickingRepo = {
  allocatePickSteps(taskId: string): Promise<AllocationResult>;
};

type RpcError = {
  code?: string;
  message?: string;
};

function mapAllocationRpcError(error: RpcError, taskId: string): Error | null {
  if (error.code !== 'P0001') return null;
  if (error.message === 'PICK_TASK_NOT_FOUND') return new PickTaskNotFoundError(taskId);
  return null;
}

export function createPickingRepo(supabase: SupabaseClient): PickingRepo {
  return {
    async allocatePickSteps(taskId) {
      const { data, error } = await supabase.rpc('allocate_pick_steps', {
        task_uuid: taskId
      });

      if (error) {
        throw mapAllocationRpcError(error, taskId) ?? error;
      }

      return allocationRpcResultSchema.parse(data);
    }
  };
}
