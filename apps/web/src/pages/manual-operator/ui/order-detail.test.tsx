import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrder, ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDetail } from './order-detail';
import { manualShiftKeys } from '@/entities/manual-shift/api/queries';
import { fireEvent } from '@testing-library/react';

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
    id: `55555555-5555-4555-8555-55555555555${unitNumber}`,
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

function renderDetail(order: ManualShiftOrder = makeOrder(), seededCheckUnits?: ManualShiftOrderCheckUnit[]) {
  const queryClient = makeQueryClient();
  if (seededCheckUnits) {
    void queryClient.setQueryData(manualShiftKeys.orderCheckUnits(order.id), seededCheckUnits);
  }
  render(
    <QueryClientProvider client={queryClient}>
      <OrderDetail order={order} onClose={vi.fn()} onDeleted={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('OrderDetail check-units section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      throw new Error(`unexpected request: ${method} ${path}`);
    });
  });

  it('shows empty state when no check units exist', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('No check units recorded yet.')).toBeTruthy();
    });
  });

  it('renders unit list with status, note and reason', async () => {
    mockedBffRequest.mockResolvedValueOnce([
      makeCheckUnit(1, 'open', { note: 'Needs recount' }),
      makeCheckUnit(2, 'checked'),
      makeCheckUnit(3, 'returned', { reason: 'Damaged wrap' })
    ]);

    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Unit #1')).toBeTruthy();
      expect(screen.getByText('Unit #2')).toBeTruthy();
      expect(screen.getByText('Unit #3')).toBeTruthy();
      expect(screen.getByText('Note: Needs recount')).toBeTruthy();
      expect(screen.getByText('Reason: Damaged wrap')).toBeTruthy();
    });
  });

  it('shows partially checked when checked and open units exist', async () => {
    mockedBffRequest.mockResolvedValueOnce([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Checked / active: 1 / 2')).toBeTruthy();
      expect(screen.getByText('Partially checked: Yes')).toBeTruthy();
      expect(screen.getByText('Physically checked: No')).toBeTruthy();
    });
  });

  it('shows physically checked when all active units are checked', async () => {
    mockedBffRequest.mockResolvedValueOnce([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Physically checked: Yes')).toBeTruthy();
      expect(screen.getByText('Open: 0')).toBeTruthy();
      expect(screen.getByText('Returned: 0')).toBeTruthy();
    });
  });

  it('returned units prevent physically checked', async () => {
    mockedBffRequest.mockResolvedValueOnce([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'returned')]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Returned: 1')).toBeTruthy();
      expect(screen.getByText('Physically checked: No')).toBeTruthy();
    });
  });

  it('excludes voided units from active count', async () => {
    mockedBffRequest.mockResolvedValueOnce([
      makeCheckUnit(1, 'checked'),
      makeCheckUnit(2, 'voided', { reason: 'Duplicate', voidedAt: '2026-05-29T09:10:00.000Z' })
    ]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Checked / active: 1 / 1')).toBeTruthy();
      expect(screen.getByText('Voided: 1')).toBeTruthy();
      expect(screen.getByText('Reason: Duplicate')).toBeTruthy();
    });
  });

  it('supports loading and error states', async () => {
    let resolvePromise: ((value: ManualShiftOrderCheckUnit[]) => void) | null = null;
    mockedBffRequest.mockImplementationOnce(
      () =>
        new Promise<ManualShiftOrderCheckUnit[]>((resolve) => {
          resolvePromise = resolve;
        })
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('check-units-loading')).toBeTruthy();
    });

    if (resolvePromise) {
      resolvePromise([]);
    }
    await waitFor(() => {
      expect(screen.getByText('No check units recorded yet.')).toBeTruthy();
    });

    mockedBffRequest.mockRejectedValueOnce(new Error('network error'));
    renderDetail(makeOrder({ id: '66666666-6666-4666-8666-666666666666' }));
    await waitFor(() => {
      expect(screen.getByTestId('check-units-error')).toBeTruthy();
    });
  });

  it('create/check/returned/void actions call correct endpoints', async () => {
    // prepare initial check units
    const seed = [
      makeCheckUnit(1, 'open'),
      makeCheckUnit(2, 'checked'),
      makeCheckUnit(3, 'voided', { reason: 'Duplicate' })
    ];

    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return seed;
      if (path.includes('/check-units') && method === 'POST') return makeCheckUnit(4, 'open');
      if (path.includes('/manual-shift-check-units') && method === 'PATCH') {
        // return a simple updated unit object; tests assert the request rather than response
        return { id: path.split('/').pop(), unitNumber: 1, status: 'checked' };
      }
      return [] as any;
    });

    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
    });

    // create new unit
    mockedBffRequest.mockResolvedValueOnce(makeCheckUnit(4, 'open'));
    fireEvent.click(screen.getByTestId('create-check-unit'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/check-units', {
        method: 'POST',
        body: JSON.stringify({})
      });
    });

    // mark open unit as checked
    mockedBffRequest.mockResolvedValueOnce(makeCheckUnit(1, 'checked'));
    const unit1 = await screen.findByTestId('check-unit-55555555-5555-4555-8555-555555555551');
    const markButton = Array.from(unit1.querySelectorAll('button')).find((b) => b.textContent?.includes('Mark checked'));
    expect(markButton).toBeTruthy();
    if (markButton) fireEvent.click(markButton);
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/55555555-5555-4555-8555-555555555551/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'checked', note: undefined, reason: undefined })
      });
    });

    // mark checked unit as returned (needs fix)
    mockedBffRequest.mockResolvedValueOnce(makeCheckUnit(2, 'returned'));
    const unit2 = await screen.findByTestId('check-unit-55555555-5555-4555-8555-555555555552');
    const needsFixButton = Array.from(unit2.querySelectorAll('button')).find((b) => b.textContent?.includes('Needs fix'));
    expect(needsFixButton).toBeTruthy();
    if (needsFixButton) fireEvent.click(needsFixButton);
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/55555555-5555-4555-8555-555555555552/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'returned', note: undefined, reason: undefined })
      });
    });

    // voided unit should not show active actions
    expect(screen.getByText('Unit #3').parentElement?.parentElement?.className).toContain('bg-gray-50');
  });
});
