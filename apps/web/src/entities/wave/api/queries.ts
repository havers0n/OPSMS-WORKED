import type { Wave, WaveSummary } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const waveKeys = {
  all: ['wave'] as const,
  list: () => [...waveKeys.all, 'list'] as const,
  detail: (waveId: string | null) => [...waveKeys.all, 'detail', waveId ?? 'none'] as const
};

async function fetchWaves(): Promise<WaveSummary[]> {
  return bffRequest<WaveSummary[]>('/api/waves');
}

async function fetchWave(waveId: string): Promise<Wave> {
  return bffRequest<Wave>(`/api/waves/${waveId}`);
}

export function wavesQueryOptions() {
  return queryOptions({
    queryKey: waveKeys.list(),
    queryFn: fetchWaves
  });
}

export function waveQueryOptions(waveId: string | null) {
  return queryOptions({
    queryKey: waveKeys.detail(waveId),
    queryFn: () => fetchWave(waveId as string),
    enabled: Boolean(waveId)
  });
}
