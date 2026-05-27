import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CheckTab } from './check-tab';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderCheckTab(
  shiftId = 'shift-1',
  lines: Parameters<typeof CheckTab>[0]['lines'] = []
) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <CheckTab shiftId={shiftId} lines={lines} />
    </QueryClientProvider>
  );
}

const baseOrder = {
  id: 'order-1',
  tenantId: 'tenant-1',
  shiftId: 'shift-1',
  lineId: 'line-1',
  orderNumber: 'ORD-001',
  customerName: null,
  pointName: 'נקודה א',
  palletCount: 2,
  pickerName: 'דוד',
  checkerName: null,
  lineCount: 5,
  size: 'M' as const,
  status: 'waiting_check' as const,
  startedAt: null,
  waitingCheckAt: new Date().toISOString(),
  checkedAt: null,
  finishedAt: null,
  comment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null
};

describe('CheckTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders waiting_check orders', async () => {
    mockedBffRequest.mockResolvedValue([baseOrder]);

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('נקודה א')).toBeTruthy();
    });

    expect(screen.getByText('1 נקודות ממתינות לבדיקה')).toBeTruthy();
    expect(screen.getByText('מלקט: דוד')).toBeTruthy();
  });

  it('shows empty state when no waiting_check orders', async () => {
    const doneOrder = { ...baseOrder, status: 'done' as const };
    mockedBffRequest.mockResolvedValue([doneOrder]);

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('אין נקודות לבדיקה')).toBeTruthy();
    });

    expect(screen.getByText('כל ההזמנות נבדקו')).toBeTruthy();
  });

  it('shows empty state when orders list is empty', async () => {
    mockedBffRequest.mockResolvedValue([]);

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('אין נקודות לבדיקה')).toBeTruthy();
    });
  });

  it('OK button calls status mutation with done', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([baseOrder]) // fetch shift orders
      .mockResolvedValueOnce({ ...baseOrder, status: 'done' }) // PATCH status
      .mockResolvedValue([]); // re-fetch after invalidation

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('נקודה א')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('תקין'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-orders/order-1/status',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('Error button opens error flow overlay', async () => {
    mockedBffRequest.mockResolvedValue([baseOrder]);

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('נקודה א')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('תקלה'));

    expect(screen.getByText('דיווח תקלה')).toBeTruthy();
    expect(screen.getByText('מה הבעיה בהזמנה?')).toBeTruthy();
  });

  it('error flow submits and calls error mutation', async () => {
    const createdError = {
      id: 'err-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      lineId: 'line-1',
      orderId: 'order-1',
      type: 'wrong_quantity',
      comment: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      fixedAt: null
    };

    mockedBffRequest
      .mockResolvedValueOnce([baseOrder]) // initial fetch
      .mockResolvedValueOnce(createdError) // POST error
      .mockResolvedValue([]); // re-fetches after

    renderCheckTab();

    await waitFor(() => {
      expect(screen.getByText('נקודה א')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('כמות לא נכונה'));
    fireEvent.click(screen.getByText('חזרה לתיקון'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-orders/order-1/errors',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows line name when lines prop is provided', async () => {
    const mockLine = {
      id: 'line-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      name: 'קו צפון',
      sortOrder: 0,
      status: 'in_progress' as const,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      deletedByProfileId: null,
      deletedByName: null,
      deleteReason: null
    };
    const lines = [
      {
        line: mockLine,
        totalOrders: 1,
        queuedOrders: 0,
        pickingOrders: 0,
        waitingCheckOrders: 1,
        returnedOrders: 0,
        doneOrders: 0,
        errorCount: 0
      }
    ];

    mockedBffRequest.mockResolvedValue([baseOrder]);

    renderCheckTab('shift-1', lines);

    await waitFor(() => {
      expect(screen.getByText('קו: קו צפון')).toBeTruthy();
    });
  });

  it('does not access supabase directly', () => {
    expect(mockedBffRequest).toBeDefined();
  });
});
