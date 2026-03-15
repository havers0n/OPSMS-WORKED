import type { Wave, WaveStatus } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { orderKeys } from '@/entities/order/api/queries';
import { waveKeys } from './queries';

type CreateWaveInput = {
  name: string;
};

type TransitionWaveInput = {
  waveId: string;
  status: WaveStatus;
};

type AttachOrderInput = {
  waveId: string;
  orderId: string;
};

async function createWave(input: CreateWaveInput): Promise<Wave> {
  return bffRequest<Wave>('/api/waves', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

async function transitionWaveStatus({ waveId, status }: TransitionWaveInput): Promise<Wave> {
  return bffRequest<Wave>(`/api/waves/${waveId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function attachOrderToWave({ waveId, orderId }: AttachOrderInput): Promise<Wave> {
  return bffRequest<Wave>(`/api/waves/${waveId}/orders`, {
    method: 'POST',
    body: JSON.stringify({ orderId })
  });
}

async function detachOrderFromWave({ waveId, orderId }: AttachOrderInput): Promise<Wave> {
  return bffRequest<Wave>(`/api/waves/${waveId}/orders/${orderId}`, {
    method: 'DELETE'
  });
}

export function useCreateWave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWave,
    onSuccess: (wave) => {
      void queryClient.invalidateQueries({ queryKey: waveKeys.all });
      queryClient.setQueryData(waveKeys.detail(wave.id), wave);
    }
  });
}

export function useTransitionWaveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transitionWaveStatus,
    onSuccess: (wave) => {
      void queryClient.invalidateQueries({ queryKey: waveKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.setQueryData(waveKeys.detail(wave.id), wave);
    }
  });
}

export function useAttachOrderToWave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: attachOrderToWave,
    onSuccess: (wave) => {
      void queryClient.invalidateQueries({ queryKey: waveKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.setQueryData(waveKeys.detail(wave.id), wave);
    }
  });
}

export function useDetachOrderFromWave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: detachOrderFromWave,
    onSuccess: (wave) => {
      void queryClient.invalidateQueries({ queryKey: waveKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.setQueryData(waveKeys.detail(wave.id), wave);
    }
  });
}
