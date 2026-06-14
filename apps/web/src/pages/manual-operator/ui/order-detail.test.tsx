import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrder, ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OrderDetail } from './order-detail';
import { pickerPath } from '@/shared/config/routes';

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
    ...overrides,
    checkStartedAt: overrides.checkStartedAt ?? null
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderDetail(order: ManualShiftOrder = makeOrder()) {
  const queryClient = makeQueryClient();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <MemoryRouter initialEntries={['/operator/manual']}>
      <QueryClientProvider client={queryClient}>
        <LocationProbe />
        <OrderDetail order={order} onClose={onClose} onDeleted={onDeleted} />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { onClose, onDeleted };
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
      expect(screen.getByText('עדיין לא נוספו משטחים')).toBeTruthy();
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
      expect(screen.getByText('#1')).toBeTruthy();
    });

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('משטח תקין') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('תקלה') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('עוד'));
    expect((screen.getByText('בטל יחידה') as HTMLButtonElement).disabled).toBe(true);
  });

  it('picking order with started check keeps actions enabled', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', checkStartedAt: '2026-05-29T09:10:00.000Z' }));
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('משטח תקין') as HTMLButtonElement).disabled).toBe(false);
  });

  it('picking + palletCount=null finishes to waiting_check without modal', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status') && method === 'PATCH') {
        return makeOrder({ status: 'waiting_check', palletCount: null });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', palletCount: null }));
    fireEvent.click(await screen.findByText('סיים ליקוט'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'waiting_check' })
      });
    });

    expect(screen.queryByText('סיום ליקוט')).toBeNull();
  });

  it('picking + palletCount=0 finishes to waiting_check without modal', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status') && method === 'PATCH') {
        return makeOrder({ status: 'waiting_check', palletCount: 0 });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', palletCount: 0 }));
    fireEvent.click(await screen.findByText('סיים ליקוט'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'waiting_check' })
      });
    });

    expect(screen.queryByText('סיום ליקוט')).toBeNull();
  });

  it('picking + palletCount>0 preserves direct transition behavior', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status') && method === 'PATCH') {
        return makeOrder({ status: 'waiting_check', palletCount: 2 });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', palletCount: 2 }));
    fireEvent.click(await screen.findByText('סיים ליקוט'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'waiting_check' })
      });
    });

    expect(
      mockedBffRequest.mock.calls.some(([url, init]) =>
        String(url).endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111') &&
        (init?.method ?? 'GET') === 'PATCH'
      )
    ).toBe(false);
  });

  it('waiting_check order keeps actions enabled', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [makeCheckUnit(1, 'open')];
      return [];
    });

    renderDetail(makeOrder({ status: 'waiting_check' }));
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());

    expect((screen.getByTestId('create-check-unit') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('משטח תקין') as HTMLButtonElement).disabled).toBe(false);
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
    await waitFor(() => expect(screen.getByText('#1')).toBeTruthy());

    expect(screen.getByText('לא ניתן לסגור: חסרים משטחים לבדיקה')).toBeTruthy();
    expect(screen.queryByText('לא ניתן לסגור: יש השלמה פתוחה')).toBeNull();
    const doneButton = screen.getByRole('button', { name: /סגור כתקין/ }) as HTMLButtonElement;
    expect(doneButton.disabled).toBe(true);
  });

  it('queued order with pickerWorkerId starts picking via bridge and does not navigate away', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shifts/orders/11111111-1111-4111-8111-111111111111/start-picking') && method === 'POST') {
        return {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          taskNumber: 'PT-1',
          tenantId: '22222222-2222-4222-8222-222222222222',
          sourceType: 'manual_shift_order',
          sourceId: '11111111-1111-4111-8111-111111111111',
          status: 'assigned',
          assignedTo: null,
          assignedWorkerId: 'worker-1',
          startedAt: null,
          completedAt: null,
          createdAt: '2026-05-29T09:00:00.000Z',
          totalSteps: 1,
          completedSteps: 0,
          steps: []
        };
      }
      return [];
    });

    const { onClose } = renderDetail(makeOrder({ status: 'queued', pickerWorkerId: 'worker-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'התחל ליקוט' }));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shifts/orders/11111111-1111-4111-8111-111111111111/start-picking',
        { method: 'POST' }
      );
    });

    expect(
      mockedBffRequest.mock.calls.some(([url, init]) =>
        String(url).endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/status') &&
        (init?.method ?? 'GET') === 'PATCH'
      )
    ).toBe(false);
    expect(screen.getByTestId('location-probe').textContent).toBe('/operator/manual');
    expect(screen.getAllByText('Point A').length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('queued order without any picker disables start and shows explanation', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      return [];
    });

    renderDetail(makeOrder({ status: 'queued', pickerName: null, pickerWorkerId: null }));

    expect(screen.getByText('יש לשייך מלקט לפני תחילת ליקוט.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'התחל ליקוט' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      mockedBffRequest.mock.calls.some(([url]) =>
        String(url).includes('/start-picking')
      )
    ).toBe(false);
  });

  it('enables start immediately after saving a free-text picker in the detail sheet', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.includes('/workers') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111') && method === 'PATCH') {
        return makeOrder({ status: 'queued', pickerName: 'Adam', pickerWorkerId: null });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'queued', pickerName: null, pickerWorkerId: null }));

    expect(screen.getByText('יש לשייך מלקט לפני תחילת ליקוט.')).toBeTruthy();
    fireEvent.click(screen.getByText('ללא מלקט'));
    fireEvent.change(await screen.findByPlaceholderText('שם המלקט'), { target: { value: 'Adam' } });
    fireEvent.click(screen.getByText('שמור שם חופשי'));

    await waitFor(() => {
      expect(screen.getByText('Adam')).toBeTruthy();
      expect(screen.queryByText('יש לשייך מלקט לפני תחילת ליקוט.')).toBeNull();
      expect((screen.getByRole('button', { name: 'התחל ליקוט' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('queued order with free-text pickerName but no pickerWorkerId can start picking', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shifts/orders/11111111-1111-4111-8111-111111111111/start-picking') && method === 'POST') {
        return {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          taskNumber: 'PT-1',
          tenantId: '22222222-2222-4222-8222-222222222222',
          sourceType: 'manual_shift_order',
          sourceId: '11111111-1111-4111-8111-111111111111',
          status: 'assigned',
          assignedTo: null,
          assignedWorkerId: null,
          startedAt: null,
          completedAt: null,
          createdAt: '2026-05-29T09:00:00.000Z',
          totalSteps: 1,
          completedSteps: 0,
          steps: []
        };
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'queued', pickerName: 'Free Picker', pickerWorkerId: null }));

    expect(screen.queryByText('יש לשייך מלקט לפני תחילת ליקוט.')).toBeNull();
    expect((screen.getByRole('button', { name: 'התחל ליקוט' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'התחל ליקוט' }));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shifts/orders/11111111-1111-4111-8111-111111111111/start-picking',
        { method: 'POST' }
      );
    });
  });

  it('bridge failure shows the backend error and stays on the operator screen', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shifts/orders/11111111-1111-4111-8111-111111111111/start-picking') && method === 'POST') {
        throw new Error('Order has no picker worker assigned.');
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'queued', pickerWorkerId: 'worker-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'התחל ליקוט' }));

    await waitFor(() => {
      expect(screen.getByText('Order has no picker worker assigned.')).toBeTruthy();
    });

    expect(screen.getByTestId('location-probe').textContent).toBe('/operator/manual');
  });

  it('picking order with pickerWorkerId renders explicit open picker action and navigates with pickerPath', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', pickerWorkerId: 'worker-1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'פתח ממשק מלקט' }));

    expect(screen.getByTestId('location-probe').textContent).toBe(pickerPath());
  });

  it('picking order keeps finish-picking override and check-start flow', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.endsWith('/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/start-check') && method === 'POST') {
        return makeOrder({ status: 'picking', pickerWorkerId: 'worker-1', checkStartedAt: '2026-05-29T09:10:00.000Z' });
      }
      return [];
    });

    renderDetail(makeOrder({ status: 'picking', pickerWorkerId: 'worker-1' }));

    expect(screen.getByRole('button', { name: 'סיים ליקוט' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'התחל בדיקה' }));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shift-orders/11111111-1111-4111-8111-111111111111/start-check',
        { method: 'POST' }
      );
    });
  });
});

describe('OrderDetail history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows history trigger row and opens overlay on click', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      if (path.includes('/events') && method === 'GET') {
        return [
          {
            id: 'e1111111-1111-4111-8111-111111111111',
            tenantId: '22222222-2222-4222-8222-222222222222',
            shiftId: '33333333-3333-4333-8333-333333333333',
            lineId: '44444444-4444-4444-8444-444444444444',
            orderId: '11111111-1111-4111-8111-111111111111',
            eventType: 'created',
            actorName: 'Dispatcher',
            actorProfileId: null,
            fromStatus: null,
            toStatus: null,
            payload: null,
            createdAt: '2026-05-26T07:00:00.000Z'
          }
        ];
      }
      return [];
    });

    renderDetail();

    expect(screen.getByText('היסטוריית הזמנה')).toBeTruthy();
    expect(screen.getByText('צפה בפעולות שבוצעו בהזמנה')).toBeTruthy();

    fireEvent.click(screen.getByText('היסטוריית הזמנה'));

    await waitFor(() => {
      expect(screen.getByText('הזמנה נוצרה')).toBeTruthy();
    });

    expect(
      mockedBffRequest.mock.calls.some(([url, init]) =>
        String(url).includes('/events') && (init?.method ?? 'GET') === 'GET'
      )
    ).toBe(true);
  });

  it('does not fetch events before overlay is opened', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/check-units') && method === 'GET') return [];
      return [];
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('היסטוריית הזמנה')).toBeTruthy();
    });

    expect(
      mockedBffRequest.mock.calls.some(([url]) => String(url).includes('/events'))
    ).toBe(false);
  });

  it('overlay closes when back button is pressed', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      if (String(url).includes('/events')) return [];
      return [];
    });
    renderDetail();
    await waitFor(() => expect(screen.getByText('היסטוריית הזמנה')).toBeTruthy());
    fireEvent.click(screen.getByText('היסטוריית הזמנה'));
    await waitFor(() => expect(screen.getByLabelText('סגור היסטוריה')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('סגור היסטוריה'));
    await waitFor(() => expect(screen.queryByLabelText('סגור היסטוריה')).toBeNull());
  });

  it('renders actor name when available', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      if (String(url).includes('/events')) return [
        {
          id: 'e1111111-1111-4111-8111-111111111111',
          tenantId: '22222222-2222-4222-8222-222222222222',
          shiftId: '33333333-3333-4333-8333-333333333333',
          lineId: '44444444-4444-4444-8444-444444444444',
          orderId: '11111111-1111-4111-8111-111111111111',
          eventType: 'created',
          actorName: 'Dispatcher',
          actorProfileId: null,
          fromStatus: null,
          toStatus: null,
          payload: null,
          createdAt: '2026-05-26T07:00:00.000Z'
        }
      ];
      return [];
    });
    renderDetail();
    fireEvent.click(await screen.findByText('היסטוריית הזמנה'));
    await waitFor(() => expect(screen.getByText('Dispatcher')).toBeTruthy());
    expect(screen.queryByText('2026-05-26T07:00:00.000Z')).toBeNull();
  });

  it('does not render raw payload JSON', async () => {
    mockedBffRequest.mockImplementation(async (url) => {
      if (String(url).includes('/events')) return [
        {
          id: 'e2222222-2222-4222-8222-222222222222',
          tenantId: '22222222-2222-4222-8222-222222222222',
          shiftId: '33333333-3333-4333-8333-333333333333',
          lineId: '44444444-4444-4444-8444-444444444444',
          orderId: '11111111-1111-4111-8111-111111111111',
          eventType: 'check_unit_created',
          actorName: null,
          actorProfileId: null,
          fromStatus: null,
          toStatus: null,
          payload: { checkUnitId: 'cu-1', unitNumber: 1, status: 'open' },
          createdAt: '2026-05-26T07:05:00.000Z'
        }
      ];
      return [];
    });
    renderDetail();
    fireEvent.click(await screen.findByText('היסטוריית הזמנה'));
    await waitFor(() => expect(screen.getByText('נוספה יחידת בדיקה 1')).toBeTruthy());
    expect(screen.queryByText('cu-1')).toBeNull();
    expect(screen.queryByText('checkUnitId')).toBeNull();
  });
});
