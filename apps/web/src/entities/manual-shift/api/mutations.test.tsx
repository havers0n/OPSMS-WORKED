// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  useApplyManualShiftExcelImport,
  usePreviewManualShiftExcelImport,
  useCreateManualShiftOrderCheckUnit,
  usePatchManualShiftOrder,
  usePatchManualShiftOrderCheckUnit,
  useUpdateManualShiftOrderCheckUnitStatus
} from './mutations';
import { manualShiftKeys } from './queries';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn(async (path: string) => {
    if (path.includes('check-units')) {
      return {
        id: 'cu1',
        tenantId: 't1',
        shiftId: 's1',
        lineId: 'l1',
        orderId: 'o1',
        unitNumber: 1,
        status: 'open',
        note: null,
        reason: null,
        checkedAt: null,
        returnedAt: null,
        voidedAt: null,
        createdAt: '',
        updatedAt: ''
      };
    }

    return {
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
    };
  })
}));

function createWrapper() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidateSpy, wrapper };
}

describe('usePatchManualShiftOrder', () => {
  it('invalidates lineOrders/shiftOrders/peopleSummary/daySummary/today after patch', async () => {
    const { invalidateSpy, wrapper } = createWrapper();
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

describe('manual shift import mutations', () => {
  it('preview mutation sends FormData with file field', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePreviewManualShiftExcelImport(), { wrapper });
    const file = new File(['xlsx-binary'], 'daily.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/manual-shifts/import/preview',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
    const call = vi.mocked(bffRequest).mock.calls.find((entry) => entry[0] === '/api/manual-shifts/import/preview');
    const formData = call?.[1]?.body as FormData;
    expect(formData.get('file')).toBe(file);
  });

  it('apply mutation invalidates queue-related keys', async () => {
    vi.mocked(bffRequest).mockResolvedValueOnce({ shiftId: 's1', linesCreated: 2, ordersCreated: 5 });
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useApplyManualShiftExcelImport('2026-06-01'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        shiftId: 's1',
        preview: {
          fileName: 'daily.xlsx',
          sheetName: 'סיכמות',
          importDateRaw: '1.6.26',
          importDate: '2026-06-01',
          lineCount: 1,
          orderCount: 1,
          lines: [{
            name: 'דרום',
            rawLabel: 'דרום',
            sourceRow: 1,
            sortOrder: 1,
            orders: [{
              pointName: 'A',
              rawLabel: 'דרום/A',
              sourceRow: 2,
              sortOrder: 1
            }]
          }]
        }
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.today() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.byDate('2026-06-01') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.shiftOrders('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.daySummary('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.peopleSummary('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.lines('s1') });
  });
});

describe('manual shift order check unit mutations', () => {
  it('create mutation sends expected request shape', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateManualShiftOrderCheckUnit('o1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ note: 'note-a', reason: 'reason-a' });
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/o1/check-units', {
      method: 'POST',
      body: JSON.stringify({ note: 'note-a', reason: 'reason-a' })
    });
  });

  it('create mutation invalidates check-units and order-level queries', async () => {
    const { invalidateSpy, wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateManualShiftOrderCheckUnit('o1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.orderCheckUnits('o1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.today() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.lineOrders('l1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.shiftOrders('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.peopleSummary('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.daySummary('s1') });
  });

  it('create mutation keeps invalidating order-level queries on repeated add', async () => {
    const { invalidateSpy, wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateManualShiftOrderCheckUnit('o1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({});
      await result.current.mutateAsync({});
    });

    const todayCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: manualShiftKeys.today() })
    );
    const lineCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: manualShiftKeys.lineOrders('l1') })
    );
    const shiftCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: manualShiftKeys.shiftOrders('s1') })
    );

    expect(todayCalls.length).toBeGreaterThanOrEqual(2);
    expect(lineCalls.length).toBeGreaterThanOrEqual(2);
    expect(shiftCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('status mutation sends expected request shape', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateManualShiftOrderCheckUnitStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        checkUnitId: 'cu1',
        status: 'checked',
        note: 'ok',
        reason: 'verified'
      });
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'checked', note: 'ok', reason: 'verified' })
    });
  });

  it('patch mutation sends expected request shape', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePatchManualShiftOrderCheckUnit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        checkUnitId: 'cu1',
        note: 'new-note',
        reason: 'new-reason'
      });
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu1', {
      method: 'PATCH',
      body: JSON.stringify({ note: 'new-note', reason: 'new-reason' })
    });
  });

  it('status mutation invalidates check-units and order-level queries', async () => {
    const { invalidateSpy, wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateManualShiftOrderCheckUnitStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ checkUnitId: 'cu1', status: 'checked' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.orderCheckUnits('o1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.today() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.lineOrders('l1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.shiftOrders('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.peopleSummary('s1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: manualShiftKeys.daySummary('s1') });
  });
});
