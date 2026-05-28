import type { PickTaskDetail } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const pickerKeys = {
  all: ['picker'] as const,
  tasks: (workerId: string | null) => [...pickerKeys.all, 'tasks', workerId ?? 'none'] as const,
  taskDetail: (taskId: string | null, workerId: string | null) =>
    [...pickerKeys.all, 'task', taskId ?? 'none', workerId ?? 'none'] as const,
};

export async function fetchPickerTasks(workerId: string): Promise<PickTaskDetail[]> {
  return bffRequest<PickTaskDetail[]>(`/api/picker/tasks?workerId=${encodeURIComponent(workerId)}`);
}

export async function fetchPickerTaskDetail(taskId: string, workerId: string): Promise<PickTaskDetail> {
  return bffRequest<PickTaskDetail>(`/api/picker/tasks/${taskId}?workerId=${encodeURIComponent(workerId)}`);
}

export function pickerTasksQueryOptions(workerId: string | null) {
  return queryOptions({
    queryKey: pickerKeys.tasks(workerId),
    queryFn: () => fetchPickerTasks(workerId as string),
    enabled: Boolean(workerId),
  });
}

export function pickerTaskDetailQueryOptions(taskId: string | null, workerId: string | null) {
  return queryOptions({
    queryKey: pickerKeys.taskDetail(taskId, workerId),
    queryFn: () => fetchPickerTaskDetail(taskId as string, workerId as string),
    enabled: Boolean(taskId) && Boolean(workerId),
  });
}
