// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  useCreateManualShiftOrderAshlama,
  usePatchManualShiftOrderAshlama
} from './mutations';
import { manualShiftKeys } from './queries';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';
const mockedBffRequest = vi.mocked(bffRequest);

const ORDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SHIFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const fakeAshlama = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  shiftId: SHIFT_ID,
  lineId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  orderId: ORDER_ID,
  checkUnitId: null,
  source: 'manual' as const,
  status: 'open' as const,
  text: 'פריט חסר',
  createdAt: '2026-05-26T07:00:00.000Z',
  updatedAt: '2026-05-26T07:00:00.000Z'
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCreateManualShiftOrderAshlama — cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates orderAshlamot and shiftOpenAshlamot after success', async () => {
    mockedBffRequest.mockResolvedValue(fakeAshlama);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateManualShiftOrderAshlama(ORDER_ID),
      { wrapper: makeWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({ text: 'פריט חסר' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calledKeys).toContainEqual({ queryKey: manualShiftKeys.orderAshlamot(ORDER_ID) });
    expect(calledKeys).toContainEqual({ queryKey: manualShiftKeys.shiftOpenAshlamot(SHIFT_ID) });
  });
});

describe('usePatchManualShiftOrderAshlama — cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates orderAshlamot and shiftOpenAshlamot after success', async () => {
    mockedBffRequest.mockResolvedValue({ ...fakeAshlama, status: 'done' });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => usePatchManualShiftOrderAshlama(ORDER_ID),
      { wrapper: makeWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({ ashlamaId: fakeAshlama.id, status: 'done' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calledKeys).toContainEqual({ queryKey: manualShiftKeys.orderAshlamot(ORDER_ID) });
    expect(calledKeys).toContainEqual({ queryKey: manualShiftKeys.shiftOpenAshlamot(SHIFT_ID) });
  });

  it('still invalidates orderAshlamot when shiftId is absent from response (defensive)', async () => {
    const ashlamaNoShift = { ...fakeAshlama, shiftId: '' };
    mockedBffRequest.mockResolvedValue(ashlamaNoShift);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => usePatchManualShiftOrderAshlama(ORDER_ID),
      { wrapper: makeWrapper(queryClient) }
    );

    await act(async () => {
      result.current.mutate({ ashlamaId: fakeAshlama.id, status: 'cancelled' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calledKeys).toContainEqual({ queryKey: manualShiftKeys.orderAshlamot(ORDER_ID) });
    // shiftOpenAshlamot is NOT called when shiftId is empty string (falsy guard)
    expect(calledKeys).not.toContainEqual({
      queryKey: manualShiftKeys.shiftOpenAshlamot('')
    });
  });
});
