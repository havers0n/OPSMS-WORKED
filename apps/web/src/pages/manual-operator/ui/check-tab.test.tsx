import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrderCheckUnit } from '@wos/domain';
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

function renderCheckTab() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <CheckTab shiftId="shift-1" lines={[]} />
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
  pointName: 'Point A',
  palletCount: 2,
  pickerName: 'Picker',
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

function makeCheckUnit(unitNumber: number, status: ManualShiftOrderCheckUnit['status']) {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as ManualShiftOrderCheckUnit;
}

function getDoneButton() {
  const buttons = screen.getAllByRole('button', { name: 'תקין' });
  return buttons[0] as HTMLButtonElement;
}

describe('CheckTab expected units close guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders waiting_check order summary with expected count', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('נבדקו 1 מתוך 2')).toBeTruthy());
  });

  it('palletCount=2 and one checked -> blocked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-missing-units-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('palletCount=2 and two checked -> enabled', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('נבדקו 2 מתוך 2')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(false);
  });

  it('open ashlama blocks done even when units are checked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot')) {
        return [{
          id: 'ash-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: 'cu-1',
          source: 'check_unit',
          status: 'open',
          text: 'missing item',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }];
      }
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());
    expect(screen.getByText('בדוק את כל יחידות הבדיקה הפעילות לפני סגירת ההזמנה')).toBeTruthy();
    expect(getDoneButton().disabled).toBe(true);
  });

  it('open manual ashlama blocks done even when units are checked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')];
      if (path.includes('/api/manual-shift-orders/order-1/ashlamot')) {
        return [{
          id: 'ash-manual-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          lineId: 'line-1',
          orderId: 'order-1',
          checkUnitId: null,
          source: 'manual',
          status: 'open',
          text: 'manual ashlama',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }];
      }
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('palletCount=2, one checked + one open -> blocked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'open')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('palletCount=2, one checked + one returned -> blocked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'returned')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('palletCount=2, one checked + one voided -> blocked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'voided')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-missing-units-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('missing palletCount -> blocked', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [{ ...baseOrder, palletCount: null }];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-missing-expected-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('started check during picking is listed but done blocked by stage', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) {
        return [{ ...baseOrder, status: 'picking' as const, waitingCheckAt: new Date().toISOString() }];
      }
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit(1, 'checked'), makeCheckUnit(2, 'checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('check-stage-close-reason-order-1')).toBeTruthy());
    expect(getDoneButton().disabled).toBe(true);
  });

  it('palletCount=3, activeUnits=0 (all voided) -> shows 0, not 3', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [{ ...baseOrder, palletCount: 3 }];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) {
        return [makeCheckUnit(1, 'voided'), makeCheckUnit(2, 'voided'), makeCheckUnit(3, 'voided')];
      }
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('0 משטחים')).toBeTruthy());
    expect(screen.queryByText('3 משטחים')).toBeNull();
  });

  it('error button opens error flow overlay', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'תקלה' }));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
