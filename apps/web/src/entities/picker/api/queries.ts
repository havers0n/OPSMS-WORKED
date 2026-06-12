import type { PickTaskDetail } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const pickerKeys = {
  all: ['picker'] as const,
  tasks: () => [...pickerKeys.all, 'tasks'] as const,
  taskDetail: (taskId: string | null) =>
    [...pickerKeys.all, 'task', taskId ?? 'none'] as const,
};

export async function fetchPickerTasks(): Promise<PickTaskDetail[]> {
  return bffRequest<PickTaskDetail[]>('/api/picker/tasks');
}

export async function fetchPickerTaskDetail(taskId: string): Promise<PickTaskDetail> {
  return bffRequest<PickTaskDetail>(`/api/picker/tasks/${taskId}`);
}

export function pickerTasksQueryOptions() {
  return queryOptions({
    queryKey: pickerKeys.tasks(),
    queryFn: fetchPickerTasks,
  });
}

export function pickerTaskDetailQueryOptions(taskId: string | null) {
  return queryOptions({
    queryKey: pickerKeys.taskDetail(taskId),
    queryFn: () => fetchPickerTaskDetail(taskId as string),
    enabled: Boolean(taskId),
  });
}
