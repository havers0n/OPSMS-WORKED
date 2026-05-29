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
    await waitFor(() => expect(screen.getByText('No check units recorded yet.')).toBeTruthy());
  });

  it('renders summary and unit list', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')]);
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Checked / active: 1 / 2')).toBeTruthy();
      expect(screen.getByTestId('check-units-list')).toBeTruthy();
      expect(screen.getByText('Unit #1')).toBeTruthy();
      expect(screen.getByText('Unit #2')).toBeTruthy();
    });
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
    await waitFor(() => expect(screen.getByText('Mark checked')).toBeTruthy());
    fireEvent.click(screen.getByText('Mark checked'));
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
    await waitFor(() => expect(screen.getByText('Needs fix')).toBeTruthy());
    fireEvent.click(screen.getByText('Needs fix'));
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
    await waitFor(() => expect(screen.getByText('Void')).toBeTruthy());
    fireEvent.click(screen.getByText('Void'));
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
    await waitFor(() => expect(screen.getByText('Unit #1')).toBeTruthy());
    expect(screen.queryByText('Mark checked')).toBeNull();
    expect(screen.queryByText('Needs fix')).toBeNull();
    expect(screen.queryByText('Void')).toBeNull();
  });
});
