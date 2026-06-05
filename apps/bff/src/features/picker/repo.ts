import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickTaskDetail, PickTaskSummary, PickTaskStatus } from '@wos/domain';
import { pickTaskSummarySchema } from '@wos/domain';
import { createPickReadRepo } from '../picking/pick-read-repo.js';

type PickTaskRow = {
  id: string;
  task_number: string;
  tenant_id: string;
  source_type: 'order' | 'wave' | 'manual_shift_order';
  source_id: string;
  status: PickTaskStatus;
  assigned_to: string | null;
  assigned_worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type PickStepRow = {
  id: string;
  task_id: string;
  status: string;
  sequence_no: number;
};

type PickStepStateRow = {
  id: string;
  task_id: string;
  tenant_id: string;
  qty_required: number;
  qty_picked: number;
  status: string;
};

const activeTaskStatuses: PickTaskStatus[] = ['assigned', 'in_progress'];

export type PickerRepo = {
  listActiveTasksByWorker(tenantId: string, workerId: string): Promise<PickTaskSummary[]>;
  findAssignedTaskDetail(tenantId: string, taskId: string, workerId: string): Promise<PickTaskDetail | null>;
  findStepForTask(taskId: string, stepId: string): Promise<PickStepStateRow | null>;
  markStepPicked(stepId: string, qtyPicked: number, executedAt: string): Promise<void>;
  listTaskSteps(taskId: string): Promise<Array<{ id: string; status: string }>>;
  updateTaskStatus(taskId: string, status: PickTaskStatus, completedAt: string | null): Promise<void>;
};

export function createPickerRepo(supabase: SupabaseClient): PickerRepo {
  const pickReadRepo = createPickReadRepo(supabase);

  return {
    async listActiveTasksByWorker(tenantId, workerId) {
      const { data: taskRows, error: taskError } = await supabase
        .from('pick_tasks')
        .select('id,task_number,tenant_id,source_type,source_id,status,assigned_to,assigned_worker_id,started_at,completed_at,created_at')
        .eq('tenant_id', tenantId)
        .eq('assigned_worker_id', workerId)
        .in('status', activeTaskStatuses)
        .order('created_at', { ascending: false });

      if (taskError) throw taskError;

      const tasks = ((taskRows ?? []) as PickTaskRow[]);
      if (tasks.length === 0) return [];

      const taskIds = tasks.map((task) => task.id);
      const { data: stepRows, error: stepError } = await supabase
        .from('pick_steps')
        .select('id,task_id,status,sequence_no')
        .in('task_id', taskIds);

      if (stepError) throw stepError;

      const stepRowsTyped = ((stepRows ?? []) as PickStepRow[]);
      const byTaskId = new Map<string, PickStepRow[]>();
      for (const row of stepRowsTyped) {
        const list = byTaskId.get(row.task_id) ?? [];
        list.push(row);
        byTaskId.set(row.task_id, list);
      }

      return tasks.map((task) => {
        const steps = byTaskId.get(task.id) ?? [];
        const totalSteps = steps.length;
        const completedSteps = steps.filter((step) => step.status === 'picked').length;
        const exceptionSteps = steps.filter((step) => step.status === 'partial' || step.status === 'skipped' || step.status === 'exception').length;

        return pickTaskSummarySchema.parse({
          id: task.id,
          taskNumber: task.task_number,
          tenantId: task.tenant_id,
          sourceType: task.source_type,
          sourceId: task.source_id,
          status: task.status,
          assignedTo: task.assigned_to,
          assignedWorkerId: task.assigned_worker_id,
          startedAt: task.started_at,
          completedAt: task.completed_at,
          createdAt: task.created_at,
          totalSteps,
          completedSteps,
          exceptionSteps
        });
      });
    },

    async findAssignedTaskDetail(tenantId, taskId, workerId) {
      const detail = await pickReadRepo.findPickTaskDetail(taskId);
      if (!detail) return null;
      if (detail.tenantId !== tenantId) return null;
      if (detail.assignedWorkerId !== workerId) return null;
      return detail;
    },

    async findStepForTask(taskId, stepId) {
      const { data, error } = await supabase
        .from('pick_steps')
        .select('id,task_id,tenant_id,qty_required,qty_picked,status')
        .eq('id', stepId)
        .eq('task_id', taskId)
        .maybeSingle();

      if (error) throw error;
      return (data as PickStepStateRow | null) ?? null;
    },

    async markStepPicked(stepId, qtyPicked, executedAt) {
      const { error } = await supabase
        .from('pick_steps')
        .update({
          qty_picked: qtyPicked,
          status: 'picked',
          executed_at: executedAt
        })
        .eq('id', stepId);

      if (error) throw error;
    },

    async listTaskSteps(taskId) {
      const { data, error } = await supabase
        .from('pick_steps')
        .select('id,status')
        .eq('task_id', taskId);

      if (error) throw error;
      return ((data ?? []) as Array<{ id: string; status: string }>);
    },

    async updateTaskStatus(taskId, status, completedAt) {
      const payload: { status: PickTaskStatus; completed_at?: string | null; started_at?: string } = { status };
      if (status === 'completed') {
        payload.completed_at = completedAt;
      }
      if (status === 'in_progress') {
        payload.started_at = completedAt ?? new Date().toISOString();
      }

      const { error } = await supabase
        .from('pick_tasks')
        .update(payload)
        .eq('id', taskId);

      if (error) throw error;
    }
  };
}
