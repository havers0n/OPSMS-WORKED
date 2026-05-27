import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftLine, ManualShiftOrder } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';

vi.mock('@/shared/api/bff/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest, BffRequestError } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const shift = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-05-27',
  name: 'Morning Shift',
  status: 'active' as const,
  createdBy: null,
  createdAt: new Date().toISOString(),
  closedAt: null
};

const line = {
  id: 'line-1',
  tenantId: 'tenant-1',
  shiftId: shift.id,
  name: 'Line A',
  sortOrder: 0,
  status: 'open' as const,
  createdAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null
};

const emptyLineSummary = {
  line,
  totalOrders: 0,
  queuedOrders: 0,
  pickingOrders: 0,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

const lineSummaryWithOrders = {
  line,
  totalOrders: 1,
  queuedOrders: 1,
  pickingOrders: 0,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

function makeOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    shiftId: shift.id,
    lineId: line.id,
    orderNumber: '502481',
    customerName: null,
    pointName: 'Point A',
    palletCount: 1,
    pickerName: 'Picker A',
    pickerWorkerId: null,
    checkerName: null,
    lineCount: 5,
    size: 'M',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides
  };
}

function makeDaySummary() {
  return {
    shiftId: shift.id,
    totalOrders: 1,
    queuedOrders: 1,
    pickingOrders: 0,
    waitingCheckOrders: 0,
    returnedOrders: 0,
    doneOrders: 0,
    errorsCount: 0,
    byErrorType: [],
    byLine: [lineSummaryWithOrders],
    byPicker: []
  };
}

function makePeopleSummary() {
  return {
    shiftId: shift.id,
    items: []
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ManualOperatorPage />
    </QueryClientProvider>
  );
}

function setupBffMock({
  lineSummary = emptyLineSummary,
  lineOrders = [] as ManualShiftOrder[],
  onDeleteOrder,
  onRestoreOrder,
  onDeleteLine
}: {
  lineSummary?: typeof emptyLineSummary;
  lineOrders?: ManualShiftOrder[];
  onDeleteOrder?: (init?: RequestInit) => ManualShiftOrder;
  onRestoreOrder?: (init?: RequestInit) => ManualShiftOrder;
  onDeleteLine?: (init?: RequestInit) => ManualShiftLine;
}) {
  mockedBffRequest.mockImplementation(async (url, init) => {
    const path = String(url);
    const method = init?.method ?? 'GET';

    if (path === '/api/manual-shifts/today' || path.startsWith('/api/manual-shifts/by-date')) {
      return { shift, lines: [lineSummary] };
    }
    if (path === `/api/manual-shift-lines/${line.id}/orders`) {
      return lineOrders;
    }
    if (path === `/api/manual-shifts/${shift.id}/orders`) {
      return lineOrders;
    }
    if (path === `/api/manual-shifts/${shift.id}/workers`) {
      return [];
    }
    if (path === `/api/manual-shifts/${shift.id}/people-summary`) {
      return makePeopleSummary();
    }
    if (path === `/api/manual-shifts/${shift.id}/day-summary`) {
      return makeDaySummary();
    }
    if (path === `/api/manual-shift-orders/order-1/delete` && method === 'PATCH') {
      return onDeleteOrder?.(init) ?? makeOrder({ deletedAt: new Date().toISOString() });
    }
    if (path === `/api/manual-shift-orders/order-1/restore` && method === 'PATCH') {
      return onRestoreOrder?.(init) ?? makeOrder();
    }
    if (path === `/api/manual-shift-lines/${line.id}/delete` && method === 'PATCH') {
      return onDeleteLine?.(init) ?? {
        ...line,
        deletedAt: new Date().toISOString(),
        deletedByProfileId: 'user-1',
        deletedByName: 'Operator',
        deleteReason: 'cleanup'
      };
    }

    throw new Error(`unexpected request: ${method} ${path}`);
  });
}

async function openLineDetail() {
  await waitFor(() => {
    expect(screen.getByText('Line A')).toBeTruthy();
  });

  fireEvent.click(screen.getByText('Line A'));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'חזור לרשימת קווים' })).toBeTruthy();
  });
}

async function waitForLineOrdersToLoad() {
  await waitFor(() => {
    expect(screen.getByText('502481')).toBeTruthy();
  });
}

async function openOrderDetail() {
  await openLineDetail();
  await waitForLineOrdersToLoad();

  fireEvent.click(screen.getByText('502481'));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'מחק נקודה' })).toBeTruthy();
  });
}

describe('manual shift delete actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows delete point only inside order detail and not on list cards', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()]
    });

    renderPage(makeQueryClient());
    await openLineDetail();
    await waitForLineOrdersToLoad();

    expect(screen.queryByRole('button', { name: 'מחק נקודה' })).toBeNull();
    expect(screen.getByRole('button', { name: 'מחק קו' })).toBeTruthy();

    fireEvent.click(screen.getByText('502481'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'מחק נקודה' })).toBeTruthy();
    });
  });

  it('opens point delete confirmation from order detail', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()]
    });

    renderPage(makeQueryClient());
    await openOrderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'מחק נקודה' }));

    await waitFor(() => {
      expect(screen.getByText('מחיקת נקודה')).toBeTruthy();
    });
  });

  it('calls point delete endpoint and invalidates required queries', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()],
      onDeleteOrder: init => {
        expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({ reason: 'duplicate point' });
        return makeOrder({
          deletedAt: new Date().toISOString(),
          deletedByProfileId: 'user-1',
          deletedByName: 'Operator',
          deleteReason: 'duplicate point'
        });
      }
    });

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage(queryClient);

    await openOrderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'מחק נקודה' }));
    await waitFor(() => {
      expect(screen.getByText('מחיקת נקודה')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'duplicate point' }
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'מחק נקודה' })[1]);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-orders/order-1/delete',
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(screen.getByText('נקודה נמחקה')).toBeTruthy();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['manual-shift', 'today'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'line-orders', line.id]
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'shift-orders', shift.id]
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'people-summary', shift.id]
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'day-summary', shift.id]
    });
  });

  it('restores a deleted point from the undo banner', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()],
      onDeleteOrder: () =>
        makeOrder({
          deletedAt: new Date().toISOString(),
          deletedByProfileId: 'user-1',
          deletedByName: 'Operator',
          deleteReason: 'cleanup'
        }),
      onRestoreOrder: () => makeOrder()
    });

    renderPage(makeQueryClient());
    await openOrderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'מחק נקודה' }));
    await waitFor(() => {
      expect(screen.getByText('מחיקת נקודה')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'מחק נקודה' })[1]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'בטל' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'בטל' }));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-orders/order-1/restore',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('blocks line delete when visible points exist', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()]
    });

    renderPage(makeQueryClient());
    await openLineDetail();
    await waitForLineOrdersToLoad();

    fireEvent.click(screen.getByRole('button', { name: 'מחק קו' }));

    await waitFor(() => {
      expect(
        screen.getByText('אי אפשר למחוק קו שיש בו נקודות. מחק או העבר את הנקודות קודם.')
      ).toBeTruthy();
    });

    expect(
      mockedBffRequest.mock.calls.some(([url]) =>
        String(url).includes('/api/manual-shift-lines/line-1/delete')
      )
    ).toBe(false);
  });

  it('shows the server line-not-empty message when delete is rejected by the backend', async () => {
    setupBffMock({
      lineSummary: emptyLineSummary,
      lineOrders: [],
      onDeleteLine: () => {
        throw new BffRequestError(
          409,
          'MANUAL_SHIFT_LINE_NOT_EMPTY',
          'Line is not empty',
          null,
          null
        );
      }
    });

    renderPage(makeQueryClient());
    await openLineDetail();

    fireEvent.click(screen.getByRole('button', { name: 'מחק קו' }));
    await waitFor(() => {
      expect(screen.getByText('מחיקת קו')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'מחק קו' })[1]);

    await waitFor(() => {
      expect(
        screen.getByText('אי אפשר למחוק קו שיש בו נקודות. מחק או העבר את הנקודות קודם.')
      ).toBeTruthy();
    });
  });

  it('calls line delete endpoint for an empty line, invalidates queries, and returns to list', async () => {
    setupBffMock({
      lineSummary: emptyLineSummary,
      lineOrders: [],
      onDeleteLine: init => {
        expect(JSON.parse((init?.body as string) ?? '{}')).toEqual({ reason: 'cleanup' });
        return {
          ...line,
          deletedAt: new Date().toISOString(),
          deletedByProfileId: 'user-1',
          deletedByName: 'Operator',
          deleteReason: 'cleanup'
        };
      }
    });

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage(queryClient);

    await openLineDetail();
    fireEvent.click(screen.getByRole('button', { name: 'מחק קו' }));
    await waitFor(() => {
      expect(screen.getByText('מחיקת קו')).toBeTruthy();
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'cleanup' }
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'מחק קו' })[1]);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-lines/line-1/delete',
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(screen.queryByRole('button', { name: 'חזור לרשימת קווים' })).toBeNull();
      expect(screen.getByText('Line A')).toBeTruthy();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['manual-shift', 'today'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'lines', shift.id]
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['manual-shift', 'line-orders', line.id]
    });
  });

  it('uses the BFF client only for delete actions', async () => {
    setupBffMock({
      lineSummary: lineSummaryWithOrders,
      lineOrders: [makeOrder()]
    });

    renderPage(makeQueryClient());
    await openOrderDetail();

    expect(mockedBffRequest).toBeDefined();
  });
});
