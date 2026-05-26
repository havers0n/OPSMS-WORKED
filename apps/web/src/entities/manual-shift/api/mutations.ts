import type { ManualShiftLine, ManualShiftSession } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { manualShiftKeys } from './queries';

type CreateShiftInput = { name: string; date?: string };
type CreateLineInput = { shiftId: string; name: string; sortOrder?: number };

async function createShift(input: CreateShiftInput): Promise<ManualShiftSession> {
  return bffRequest<ManualShiftSession>('/api/manual-shifts', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

async function createLine({ shiftId, name, sortOrder }: CreateLineInput): Promise<ManualShiftLine> {
  return bffRequest<ManualShiftLine>(`/api/manual-shifts/${shiftId}/lines`, {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder })
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}

export function useCreateLine(shiftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateLineInput, 'shiftId'>) => createLine({ ...input, shiftId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lines(shiftId) });
    }
  });
}
