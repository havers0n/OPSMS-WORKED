import type { ManualShiftTodayResponse } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const manualShiftKeys = {
  all: ['manual-shift'] as const,
  today: () => [...manualShiftKeys.all, 'today'] as const,
  lines: (shiftId: string) => [...manualShiftKeys.all, 'lines', shiftId] as const
};

async function fetchTodayShift(): Promise<ManualShiftTodayResponse> {
  return bffRequest<ManualShiftTodayResponse>('/api/manual-shifts/today');
}

export function todayShiftQueryOptions() {
  return queryOptions({
    queryKey: manualShiftKeys.today(),
    queryFn: fetchTodayShift
  });
}
