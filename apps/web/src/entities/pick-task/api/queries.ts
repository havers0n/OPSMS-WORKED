import type { PickTaskDetail } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const pickTaskKeys = {
  all: ['pick-task'] as const,
  detail: (taskId: string | null) => [...pickTaskKeys.all, 'detail', taskId ?? 'none'] as const
};

async function fetchPickTaskDetail(taskId: string): Promise<PickTaskDetail> {
  return bffRequest<PickTaskDetail>(`/api/pick-tasks/${taskId}`);
}

export function pickTaskDetailQueryOptions(taskId: string | null) {
  return queryOptions({
    queryKey: pickTaskKeys.detail(taskId),
    queryFn: () => fetchPickTaskDetail(taskId as string),
    enabled: Boolean(taskId)
  });
}
