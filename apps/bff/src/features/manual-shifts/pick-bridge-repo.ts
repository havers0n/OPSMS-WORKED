import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickTaskDetail } from '@wos/domain';
import { createPickReadRepo } from '../picking/pick-read-repo.js';

export type PickBridgeRepo = {
  findPickTaskBySource(
    sourceType: string,
    sourceId: string
  ): Promise<{ id: string } | null>;
  createPickTask(input: {
    tenantId: string;
    sourceType: string;
    sourceId: string;
    assignedTo: string | null;
    assignedWorkerId: string | null;
  }): Promise<{ id: string }>;
  createPickStep(input: {
    tenantId: string;
    taskId: string;
    sequenceNo: number;
    sku: string;
    itemName: string;
    qtyRequired: number;
  }): Promise<void>;
  findPickTaskDetail(taskId: string): Promise<PickTaskDetail | null>;
};

export function createPickBridgeRepo(supabase: SupabaseClient): PickBridgeRepo {
  const pickReadRepo = createPickReadRepo(supabase);

  return {
    async findPickTaskBySource(sourceType, sourceId) {
      const { data, error } = await supabase
        .from('pick_tasks')
        .select('id')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .maybeSingle();

      if (error) throw error;
      return (data as { id: string } | null) ?? null;
    },

    async createPickTask(input) {
      const { data, error } = await supabase
        .from('pick_tasks')
        .insert({
          tenant_id: input.tenantId,
          source_type: input.sourceType,
          source_id: input.sourceId,
          assigned_to: input.assignedTo,
          assigned_worker_id: input.assignedWorkerId,
          status: 'assigned'
        })
        .select('id')
        .single();

      if (error) {
        // Source-level unique constraint can race under retries/concurrency.
        // Resolve by returning the existing source task (idempotent behavior).
        if ((error as { code?: string }).code === '23505') {
          const existing = await this.findPickTaskBySource(input.sourceType, input.sourceId);
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
      return data as { id: string };
    },

    async createPickStep(input) {
      const { error } = await supabase
        .from('pick_steps')
        .insert({
          tenant_id: input.tenantId,
          task_id: input.taskId,
          sequence_no: input.sequenceNo,
          sku: input.sku,
          item_name: input.itemName,
          qty_required: input.qtyRequired,
          qty_picked: 0,
          status: 'pending'
        });

      if (error) throw error;
    },

    async findPickTaskDetail(taskId) {
      return pickReadRepo.findPickTaskDetail(taskId);
    }
  };
}
