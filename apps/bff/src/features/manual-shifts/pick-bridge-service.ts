import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickTaskDetail } from '@wos/domain';
import { ApiError } from '../../errors.js';
import {
  manualShiftOrderNoPickerWorker,
  manualShiftOrderNotFound,
  manualShiftOrderNotPickable
} from './errors.js';
import type { ManualShiftsRepo } from './repo.js';
import { createManualShiftsRepo } from './repo.js';
import type { PickBridgeRepo } from './pick-bridge-repo.js';
import { createPickBridgeRepo } from './pick-bridge-repo.js';

type ActorContext = {
  actorProfileId: string | null;
  actorName: string | null;
};

export type PickBridgeService = {
  startPicking(input: {
    tenantId: string;
    orderId: string;
    actor: ActorContext;
  }): Promise<PickTaskDetail>;
};

export function createPickBridgeService(
  manualShiftsRepo: ManualShiftsRepo,
  pickBridgeRepo: PickBridgeRepo,
  options?: { getNowIso?: () => string }
): PickBridgeService {
  const getNowIso = options?.getNowIso ?? (() => new Date().toISOString());

  return {
    async startPicking(input) {
      const order = await manualShiftsRepo.findOrderById(input.orderId);
      if (!order || order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      if (!order.pickerWorkerId) {
        throw manualShiftOrderNoPickerWorker(input.orderId);
      }

      // Idempotency: return existing task without changes
      const existing = await pickBridgeRepo.findPickTaskBySource('manual_shift_order', order.id);
      if (existing) {
        const detail = await pickBridgeRepo.findPickTaskDetail(existing.id);
        if (!detail) {
          throw new ApiError(500, 'PICK_TASK_INCONSISTENT', `Pick task ${existing.id} record is missing.`);
        }
        return detail;
      }

      if (order.status !== 'queued' && order.status !== 'picking') {
        throw manualShiftOrderNotPickable(input.orderId, order.status);
      }

      // Transition order to picking if it is still queued
      if (order.status === 'queued') {
        const nowIso = getNowIso();
        await manualShiftsRepo.updateOrder(order.id, {
          status: 'picking',
          startedAt: nowIso
        });
        await manualShiftsRepo.createOrderEvent({
          tenantId: input.tenantId,
          shiftId: order.shiftId,
          lineId: order.lineId,
          orderId: order.id,
          eventType: 'status_changed',
          actorProfileId: input.actor.actorProfileId,
          actorName: input.actor.actorName,
          fromStatus: 'queued',
          toStatus: 'picking',
          payload: null
        });
      }

      // Create pick task
      const task = await pickBridgeRepo.createPickTask({
        tenantId: input.tenantId,
        sourceType: 'manual_shift_order',
        sourceId: order.id,
        assignedTo: order.pickerWorkerId
      });

      // Generate one step from the order's available read model
      const sku = (order.orderNumber ?? order.pointName ?? 'MANUAL').trim() || 'MANUAL';
      const itemName = (order.pointName ?? order.orderNumber ?? 'Manual order').trim() || 'Manual order';
      const qtyRequired = Math.max(order.palletCount ?? order.lineCount ?? 1, 1);

      await pickBridgeRepo.createPickStep({
        tenantId: input.tenantId,
        taskId: task.id,
        sequenceNo: 1,
        sku,
        itemName,
        qtyRequired
      });

      const detail = await pickBridgeRepo.findPickTaskDetail(task.id);
      if (!detail) {
        throw new ApiError(500, 'PICK_TASK_INCONSISTENT', 'Pick task record missing after creation.');
      }
      return detail;
    }
  };
}

export function createPickBridgeServiceFromSupabase(supabase: SupabaseClient): PickBridgeService {
  return createPickBridgeService(
    createManualShiftsRepo(supabase),
    createPickBridgeRepo(supabase)
  );
}
