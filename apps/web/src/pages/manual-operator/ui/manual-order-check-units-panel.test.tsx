import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOrderCheckUnitsPanel } from './manual-order-check-units-panel';

vi.mock('@/shared/api/bff/client', async importOriginal => {
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

function makeCheckUnit(
  unitNumber: number,
  status: ManualShiftOrderCheckUnit['status']
): ManualShiftOrderCheckUnit {
  return {
    id: `cu-${unitNumber}`,
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderId: 'order-1',
    unitNumber,
    status,
    note: null,
    reason: null,
    checkedAt: null,
    returnedAt: null,
    voidedAt: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z'
  };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ManualOrderCheckUnitsPanel orderId="order-1" interactive />
    </QueryClientProvider>
  );
}

describe('ManualOrderCheckUnitsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו יחידות בדיקה')).toBeTruthy());
  });

  it('renders summary and unit list', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy();
      expect(screen.getByTestId('check-units-status-chip')).toBeTruthy();
      expect(screen.getByText('נבדק חלקית')).toBeTruthy();
      expect(screen.getByText('פרטים')).toBeTruthy();
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
      expect(screen.getByText('יחידה #1')).toBeTruthy();
      expect(screen.getByText('יחידה #2')).toBeTruthy();
    });
    expect(screen.queryByText('נבדק חלקית: לא')).toBeNull();
    expect(screen.queryByText('כל היחידות נבדקו: לא')).toBeNull();
  });

  it('add unit calls create mutation', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(makeCheckUnit(1, 'open'));
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('create-check-unit')).toBeTruthy());
    fireEvent.click(screen.getByTestId('create-check-unit'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/order-1/check-units', {
        method: 'POST',
        body: JSON.stringify({})
      });
    });
  });

  it('mark checked calls status mutation with checked', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'open')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'checked'));
    renderPanel();
    await waitFor(() => expect(screen.getByText('סמן כנבדק')).toBeTruthy());
    fireEvent.click(screen.getByText('סמן כנבדק'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'checked', note: undefined, reason: undefined })
      });
    });
  });

  it('needs fix calls status mutation with returned', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'checked')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'returned'));
    renderPanel();
    await waitFor(() => expect(screen.getByText('דורש תיקון')).toBeTruthy());
    fireEvent.click(screen.getByText('דורש תיקון'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'returned', note: undefined, reason: undefined })
      });
    });
  });

  it('void calls status mutation with voided', async () => {
    mockedBffRequest
      .mockResolvedValueOnce([makeCheckUnit(1, 'open')])
      .mockResolvedValueOnce(makeCheckUnit(1, 'voided'));
    renderPanel();
    await waitFor(() => expect(screen.getByText('בטל יחידה')).toBeTruthy());
    fireEvent.click(screen.getByText('בטל יחידה'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-check-units/cu-1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'voided', note: undefined, reason: undefined })
      });
    });
  });

  it('voided units show no active actions', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'voided')]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('יחידה #1')).toBeTruthy());
    expect(screen.queryByText('סמן כנבדק')).toBeNull();
    expect(screen.queryByText('דורש תיקון')).toBeNull();
    expect(screen.queryByText('בטל יחידה')).toBeNull();
  });

  it('shows returned chip and keeps voided excluded from active count', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'returned'), makeCheckUnit(3, 'voided')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy();
      expect(screen.getByTestId('check-units-status-chip').textContent).toBe('דורש תיקון');
    });
  });

  it('no-units state shows dominant add button and no metrics', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderPanel();
    await waitFor(() => expect(screen.getByText('עדיין לא נוספו יחידות בדיקה')).toBeTruthy());
    const addButton = screen.getByTestId('create-check-unit');
    expect(addButton.className).toContain('bg-blue-600');
    expect(screen.queryByTestId('check-units-summary')).toBeNull();
    expect(screen.queryByTestId('check-units-details')).toBeNull();
  });
});
