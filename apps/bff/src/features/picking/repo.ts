import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  InvalidPickQuantityError,
  PickStepNotExecutableError,
  PickStepNotFoundError,
  PickTaskNotFoundError
} from './errors.js';

// ── Allocation ────────────────────────────────────────────────────────────────

const allocationRpcResultSchema = z.object({
  taskId: z.string().uuid(),
  allocated: z.number().int().min(0),
  needsReplenishment: z.number().int().min(0)
});

export type AllocationResult = z.infer<typeof allocationRpcResultSchema>;

// ── Execution ─────────────────────────────────────────────────────────────────

const executePickStepRpcResultSchema = z.object({
  stepId: z.string().uuid(),
  status: z.enum(['picked', 'partial']),
  qtyPicked: z.number().int().min(0),
  taskId: z.string().uuid(),
  taskStatus: z.enum(['in_progress', 'completed', 'completed_with_exceptions']),
  orderStatus: z.string().nullable(),
  waveStatus: z.string().nullable(),
  movementId: z.string().uuid().nullable()
});

export type ExecutePickStepResult = z.infer<typeof executePickStepRpcResultSchema>;

export type PickingRepo = {
  allocatePickSteps(taskId: string): Promise<AllocationResult>;
  executePickStep(
    stepId: string,
    qtyActual: number,
    pickContainerId: string,
    actorId: string | null
  ): Promise<ExecutePickStepResult>;
};

// ── Error mapping ─────────────────────────────────────────────────────────────

type RpcError = {
  code?: string;
  message?: string;
};

function mapAllocationRpcError(error: RpcError, taskId: string): Error | null {
  if (error.code !== 'P0001') return null;
  if (error.message === 'PICK_TASK_NOT_FOUND') return new PickTaskNotFoundError(taskId);
  return null;
}

function mapExecutionRpcError(error: RpcError, stepId: string): Error | null {
  if (error.code !== 'P0001') return null;
  switch (error.message) {
    case 'PICK_STEP_NOT_FOUND':
      return new PickStepNotFoundError(stepId);
    case 'PICK_TASK_NOT_FOUND':
      return new PickTaskNotFoundError(stepId);
    case 'PICK_STEP_NOT_EXECUTABLE':
    case 'PICK_STEP_NOT_ALLOCATED':
      return new PickStepNotExecutableError(stepId, error.message);
    case 'INVALID_PICK_QUANTITY':
    case 'PICK_QUANTITY_EXCEEDS_AVAILABLE':
    case 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE':
      return new InvalidPickQuantityError(error.message);
    default:
      return null;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

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
    },

    async executePickStep(stepId, qtyActual, pickContainerId, actorId) {
      const { data, error } = await supabase.rpc('execute_pick_step', {
        step_uuid:           stepId,
        qty_actual:          qtyActual,
        pick_container_uuid: pickContainerId,
        actor_uuid:          actorId ?? null
      });

      if (error) {
        throw mapExecutionRpcError(error, stepId) ?? error;
      }

      return executePickStepRpcResultSchema.parse(data);
    }
  };
}
