import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { pickTaskKeys } from './queries';

// ── executePickStep ───────────────────────────────────────────────────────────

type ExecutePickStepInput = {
  stepId: string;
  qtyActual: number;
  pickContainerId: string;
};

type ExecutePickStepResult = {
  stepId: string;
  status: 'picked' | 'partial';
  qtyPicked: number;
  taskId: string;
  taskStatus: 'in_progress' | 'completed' | 'completed_with_exceptions';
  orderStatus: string | null;
  waveStatus: string | null;
  movementId: string | null;
};

async function executePickStep({ stepId, ...body }: ExecutePickStepInput): Promise<ExecutePickStepResult> {
  return bffRequest<ExecutePickStepResult>(`/api/pick-steps/${stepId}/execute`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function useExecutePickStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: executePickStep,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: pickTaskKeys.detail(result.taskId) });
    }
  });
}
