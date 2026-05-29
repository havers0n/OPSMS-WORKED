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

function makeCheckUnit(status: ManualShiftOrderCheckUnit['status']) {
  return {
    id: `cu-${status}`,
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderId: 'order-1',
    unitNumber: 1,
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

function getActionButtons() {
  const cards = screen.getAllByText('Point A');
  const card = cards[0].closest('div[class*="shadow-sm"]') as HTMLElement;
  const doneButton = card.querySelector('button.h-14.bg-green-600') as HTMLButtonElement;
  const errorButton = card.querySelector('button.h-14.bg-red-50') as HTMLButtonElement;
  return { errorButton, doneButton };
}

describe('CheckTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders waiting_check orders and check-unit summary', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit('checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Checked / active: 1 / 1')).toBeTruthy());
  });

  it('shows empty state when no waiting_check orders', async () => {
    mockedBffRequest.mockResolvedValue([{ ...baseOrder, status: 'done' as const }]);
    renderCheckTab();
    await waitFor(() =>
      expect(screen.getByText('אין נקודות לבדיקה')).toBeTruthy()
    );
  });

  it('no-units legacy done remains enabled', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/api/manual-shifts/shift-1/orders') && method === 'GET') return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units') && method === 'GET') return [];
      if (path.includes('/api/manual-shift-orders/order-1/status') && method === 'PATCH') return { ...baseOrder, status: 'done' };
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());

    // Assert real Hebrew text for error/OK buttons
    expect(screen.getByText('תקין')).toBeTruthy();
    expect(screen.getByText('תקלה')).toBeTruthy();

    const { doneButton } = getActionButtons();
    expect(doneButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(doneButton);
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/order-1/status', expect.objectContaining({ method: 'PATCH' }));
    });
  });

  it('open unit disables done and shows reason', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit('open')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());

    // Assert real Hebrew text for close reason
    expect(screen.getByText('בדוק את כל יחידות הבדיקה הפעילות לפני סגירת ההזמנה')).toBeTruthy();

    const { doneButton } = getActionButtons();
    expect(doneButton.hasAttribute('disabled')).toBe(true);
  });

  it('returned unit disables done', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit('returned')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('check-units-close-reason-order-1')).toBeTruthy());
    const { doneButton } = getActionButtons();
    expect(doneButton.hasAttribute('disabled')).toBe(true);
  });

  it('all active checked enables done', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit('checked')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());
    const { doneButton } = getActionButtons();
    expect(doneButton.hasAttribute('disabled')).toBe(false);
  });

  it('Error button opens error flow overlay', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());
    const { errorButton } = getActionButtons();
    fireEvent.click(errorButton);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('does not show loading readiness wording', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByTestId('create-check-unit')).toBeTruthy());
    expect(screen.queryByText(/ready for loading/i)).toBeNull();
    expect(screen.queryByText(/loading readiness/i)).toBeNull();
  });

  it('anti-regression: rendered Check tab must not contain obvious corrupted placeholder text like "???"', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/api/manual-shifts/shift-1/orders')) return [baseOrder];
      if (path.includes('/api/manual-shift-orders/order-1/check-units')) return [makeCheckUnit('open')];
      return [];
    });

    renderCheckTab();
    await waitFor(() => expect(screen.getByText('Point A')).toBeTruthy());

    // Verify no text elements in the entire document contain "???"
    const allTextElements = screen.queryAllByText((t) => t.includes('???'));
    expect(allTextElements.length).toBe(0);
  });
});
