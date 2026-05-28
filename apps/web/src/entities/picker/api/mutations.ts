import type { PickTaskDetail } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { pickerKeys } from './queries';

type ConfirmPickStepInput = {
  taskId: string;
  stepId: string;
  workerId: string;
  qtyPicked: number;
};

export async function confirmPickStep({
  taskId,
  stepId,
  workerId,
  qtyPicked,
}: ConfirmPickStepInput): Promise<PickTaskDetail> {
  return bffRequest<PickTaskDetail>(
    `/api/picker/tasks/${taskId}/steps/${stepId}/confirm?workerId=${encodeURIComponent(workerId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ qtyPicked }),
    }
  );
}

export function useConfirmPickStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: confirmPickStep,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: pickerKeys.tasks(variables.workerId) });
      void queryClient.invalidateQueries({
        queryKey: pickerKeys.taskDetail(variables.taskId, variables.workerId),
      });
    },
  });
}
