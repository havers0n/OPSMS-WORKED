import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrder, ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDetail } from './order-detail';

vi.mock('@/shared/api/bff/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function makeOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    shiftId: '33333333-3333-4333-8333-333333333333',
    lineId: '44444444-4444-4444-8444-444444444444',
    orderNumber: '502481',
    customerName: null,
    pointName: 'Point A',
    palletCount: 2,
    pickerName: 'Picker A',
    pickerWorkerId: null,
    checkerName: null,
    lineCount: 5,
    size: 'M',
    status: 'waiting_check',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides
  };
}

function makeCheckUnit(
  unitNumber: number,
  status: ManualShiftOrderCheckUnit['status'],
  overrides: Partial<ManualShiftOrderCheckUnit> = {}
): ManualShiftOrderCheckUnit {
  return {
    id: `cu-${unitNumber}`,
    tenantId: '22222222-2222-4222-8222-222222222222',
    shiftId: '33333333-3333-4333-8333-333333333333',
    lineId: '44444444-4444-4444-8444-444444444444',
    orderId: '11111111-1111-4111-8111-111111111111',
    unitNumber,
    status,
    note: null,
    reason: null,
    checkedAt: null,
    returnedAt: null,
    voidedAt: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    ...overrides
  };
}

function renderDetail(order: ManualShiftOrder = makeOrder()) {
  const queryClient = makeQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <OrderDetail order={order} onClose={vi.fn()} onDeleted={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('OrderDetail check-units section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no check units exist', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      return [];
    });

    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('עדיין לא נוספו יחידות בדיקה')).toBeTruthy();
    });
  });

  it('picking order without check start shows hint and disables actions', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      return [];
    });

    renderDetail(makeOrder({ status: 'picking' }));

    await waitFor(() => {
      expect(screen.getByText('התחל בדיקה כדי להתחיל לבדוק יחידות')).toBeTruthy();
      expect(screen.getByText('יחידה #1')).toBeTruthy();
    });

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('יחידה תקינה') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('תקלה') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('בטל יחידה') as HTMLButtonElement).disabled).toBe(true);
  });

  it('picking order with started check keeps actions enabled', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', waitingCheckAt: '2026-05-29T09:10:00.000Z' }));
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('יחידה תקינה') as HTMLButtonElement).disabled).toBe(false);
  });

  it('picking completion requires confirmation: cancel does not mutate', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      return [];
    });

    renderDetail(makeOrder({ status: 'picking' }));
    fireEvent.click(await screen.findByText('סיים ליקוט'));

    expect(screen.getByText('סיום ליקוט')).toBeTruthy();
    expect(screen.getByText('האם כל היחידות הגיעו לבדיקה? לאחר אישור ניתן יהיה לסגור את הבדיקה כתקינה אם כל היחידות נבדקו.')).toBeTruthy();
    fireEvent.click(screen.getByText('ביטול'));

    await waitFor(() => {
      expect(
        mockedBffRequest.mock.calls.some(([url, init]) =>
          String(url).includes('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111') &&
          (init as RequestInit | undefined)?.method === 'PATCH'
        )
      ).toBe(false);
    });
  });

  it('picking completion confirm patches palletCount then transitions to waiting_check', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111') && method === 'PATCH') {
        return makeOrder({ status: 'picking', palletCount: 2 });
      }
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status') && method === 'PATCH') {
        return makeOrder({ status: 'waiting_check', palletCount: 2 });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', palletCount: 2 }));
    fireEvent.click(await screen.findByText('סיים ליקוט'));
    fireEvent.click(screen.getByText('כן, כל היחידות הגיעו'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        body: JSON.stringify({
          pickerName: undefined,
          pickerWorkerId: undefined,
          lineCount: undefined,
          palletCount: 2,
          startedAt: undefined,
          waitingCheckAt: undefined,
          finishedAt: undefined,
          checkedAt: undefined
        })
      });
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'waiting_check' })
      });
    });
  });

  it('waiting_check order keeps actions enabled', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      return [];
    });

    renderDetail(makeOrder({ status: 'waiting_check' }));
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('יחידה תקינה') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows one canonical finalize blocking reason and disables תקין', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'checked')];
      if (path.includes('/ashlamot') && method === 'GET') return [];
      return [];
    });

    renderDetail(makeOrder({ status: 'waiting_check', palletCount: 2 }));
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());

    expect(screen.getByText('לא ניתן לסגור: חסרות יחידות לבדיקה')).toBeTruthy();
    expect(screen.queryByText('לא ניתן לסגור: יש השלמה פתוחה')).toBeNull();
    const doneButton = screen.getByRole('button', { name: /סגור כתקין/ }) as HTMLButtonElement;
    expect(doneButton.disabled).toBe(true);
  });
});
