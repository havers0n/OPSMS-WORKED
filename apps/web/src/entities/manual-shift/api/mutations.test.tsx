// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { usePatchManualShiftOrder } from './mutations';
import { manualShiftKeys } from './queries';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn(async () => ({
    id: 'o1',
    tenantId: 't1',
    shiftId: 's1',
    lineId: 'l1',
    pointName: 'p',
    orderNumber: null,
    customerName: null,
    palletCount: null,
    pickerName: 'n',
    pickerWorkerId: 'w1',
    checkerName: null,
    lineCount: null,
    size: 'unknown',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null
  }))
}));

describe('usePatchManualShiftOrder', () => {
  it('invalidates lineOrders/shiftOrders/peopleSummary/daySummary/today after patch', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePatchManualShiftOrder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        orderId: 'o1',
        lineId: 'l1',
        shiftId: 's1',
        pickerWorkerId: 'w1'
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.today() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.lineOrders('l1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.shiftOrders('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.peopleSummary('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.daySummary('s1') });
  });
});
