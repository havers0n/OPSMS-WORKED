import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { PickTaskDetail, PickTaskSummary } from '@wos/domain';
import { ApiError } from '../../errors.js';
import { createManualShiftsRepo, type ManualShiftsRepo } from '../manual-shifts/repo.js';
import { createPickerRepo, type PickerRepo } from './repo.js';

const confirmQtySchema = z.number().positive();

type ConfirmStepCommand = {
  tenantId: string;
  workerId: string;
  taskId: string;
  stepId: string;
  qtyPicked: number;
};

export type PickerService = {
  listTasks(input: { tenantId: string; workerId: string }): Promise<PickTaskSummary[]>;
  getTaskDetail(input: { tenantId: string; workerId: string; taskId: string }): Promise<PickTaskDetail>;
  confirmStep(input: ConfirmStepCommand): Promise<PickTaskDetail>;
};

export function createPickerService(
  pickerRepo: PickerRepo,
  manualShiftsRepo: ManualShiftsRepo,
  options?: { getNowIso?: () => string }
): PickerService {
  const getNowIso = options?.getNowIso ?? (() => new Date().toISOString());

  async function assertWorkerAccess(tenantId: string, workerId: string): Promise<void> {
    const worker = await manualShiftsRepo.findWorkerById(workerId);
    if (!worker || worker.tenantId !== tenantId) {
      throw new ApiError(403, 'PICKER_WORKER_FORBIDDEN', `Worker ${workerId} is not accessible in current tenant.`);
    }

    if (!worker.active) {
      throw new ApiError(403, 'PICKER_WORKER_INACTIVE', `Worker ${workerId} is inactive.`);
    }
  }

  return {
    async listTasks(input) {
      await assertWorkerAccess(input.tenantId, input.workerId);
      return pickerRepo.listActiveTasksByWorker(input.tenantId, input.workerId);
    },

    async getTaskDetail(input) {
      await assertWorkerAccess(input.tenantId, input.workerId);
      const detail = await pickerRepo.findAssignedTaskDetail(input.tenantId, input.taskId, input.workerId);
      if (!detail) {
        throw new ApiError(404, 'PICK_TASK_NOT_FOUND', `Pick task ${input.taskId} not found.`);
      }
      return detail;
    },

    async confirmStep(input) {
      const qtyPicked = confirmQtySchema.parse(input.qtyPicked);
      await assertWorkerAccess(input.tenantId, input.workerId);
      const detail = await pickerRepo.findAssignedTaskDetail(input.tenantId, input.taskId, input.workerId);
      if (!detail) {
        throw new ApiError(404, 'PICK_TASK_NOT_FOUND', `Pick task ${input.taskId} not found.`);
      }

      const step = await pickerRepo.findStepForTask(input.taskId, input.stepId);
      if (!step) {
        throw new ApiError(404, 'PICK_STEP_NOT_FOUND', `Pick step ${input.stepId} not found for task ${input.taskId}.`);
      }

      if (qtyPicked > step.qty_required) {
        throw new ApiError(
          400,
          'PICK_STEP_QTY_EXCEEDS_REQUIRED',
          `Picked quantity ${qtyPicked} exceeds required quantity ${step.qty_required}.`
        );
      }

      const nowIso = getNowIso();
      if (step.status === 'picked') {
        if (step.qty_picked !== qtyPicked) {
          throw new ApiError(
            409,
            'PICK_STEP_ALREADY_CONFIRMED',
            `Pick step ${input.stepId} is already confirmed with qtyPicked=${step.qty_picked}.`
          );
        }
      } else {
        if (step.status !== 'pending') {
          throw new ApiError(
            409,
            'PICK_STEP_NOT_CONFIRMABLE',
            `Pick step ${input.stepId} cannot be confirmed from status ${step.status}.`
          );
        }
        await pickerRepo.markStepPicked(input.stepId, qtyPicked, nowIso);
      }

      const taskSteps = await pickerRepo.listTaskSteps(input.taskId);
      const allConfirmed = taskSteps.length > 0 && taskSteps.every((taskStep) => taskStep.status === 'picked');

      if (allConfirmed) {
        // Limitation: this is not a DB transaction; task and source-order updates can partially succeed.
        // Order below is intentional: complete task first, then transition manual_shift_order if still picking.
        await pickerRepo.updateTaskStatus(input.taskId, 'completed', nowIso);

        if (detail.sourceType === 'manual_shift_order') {
          const order = await manualShiftsRepo.findOrderById(detail.sourceId);
          if (order && order.tenantId === input.tenantId && order.status === 'picking') {
            await manualShiftsRepo.updateOrder(order.id, {
              status: 'waiting_check',
              waitingCheckAt: nowIso
            });
          }
        }
      } else if (detail.status === 'assigned') {
        await pickerRepo.updateTaskStatus(input.taskId, 'in_progress', nowIso);
      }

      const updated = await pickerRepo.findAssignedTaskDetail(input.tenantId, input.taskId, input.workerId);
      if (!updated) {
        throw new ApiError(500, 'PICK_TASK_INCONSISTENT', `Pick task ${input.taskId} became unavailable after step confirmation.`);
      }

      return updated;
    }
  };
}

export function createPickerServiceFromSupabase(supabase: SupabaseClient): PickerService {
  return createPickerService(
    createPickerRepo(supabase),
    createManualShiftsRepo(supabase)
  );
}
