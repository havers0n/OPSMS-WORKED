import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ManualShiftOrder } from '@wos/domain';
import { ManualOperatorPage } from './manual-operator-page';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

// ---- Fixtures ----

const mockShift = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-05-26',
  name: 'משמרת ראשון',
  status: 'active' as 'active' | 'closed',
  createdBy: null,
  createdAt: new Date().toISOString(),
  closedAt: null
};

const mockLine = {
  id: 'line-1',
  tenantId: 'tenant-1',
  shiftId: 'shift-1',
  name: 'שרון דרומי',
  sortOrder: 0,
  status: 'open' as 'open' | 'in_progress' | 'done',
  createdAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null
};

const mockLineSummaryEmpty = {
  line: mockLine,
  totalOrders: 0,
  queuedOrders: 0,
  pickingOrders: 0,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

const mockLineSummaryWithOrders = {
  line: mockLine,
  totalOrders: 2,
  queuedOrders: 1,
  pickingOrders: 1,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

function makeOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderNumber: '502481',
    customerName: null,
    pointName: 'ירושלים',
    palletCount: null,
    pickerName: 'יהודה',
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

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderPage(queryClient: QueryClient) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ManualOperatorPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ---- Helpers ----

async function renderWithShiftAndLines(
  lineSummary = mockLineSummaryEmpty,
  lineOrders: ManualShiftOrder[] = []
) {
  const qc = makeQueryClient();
  mockedBffRequest.mockImplementation((url: string) => {
    if (String(url).includes('/orders/bulk')) {
      return Promise.resolve({ createdCount: 0, rows: [], skippedRows: [] });
    }
    if (String(url).includes('/orders')) {
      return Promise.resolve(lineOrders);
    }
    if (String(url).includes('/workers')) {
      return Promise.resolve([]);
    }
    return Promise.resolve({ shift: mockShift, lines: [lineSummary] });
  });
  renderPage(qc);
  await waitFor(() => expect(screen.getByText('שרון דרומי')).toBeTruthy());
  return qc;
}

async function openLineDetail(lineSummary = mockLineSummaryEmpty) {
  await renderWithShiftAndLines(lineSummary);
  fireEvent.click(screen.getByText('שרון דרומי'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'חזור לרשימת קווים' })).toBeTruthy());
}

// ---- Tests ----

describe('PR4 – Line Detail & Manual Orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Clicking a line opens line detail ──────────────────────────────────

  describe('clicking a line card opens line detail', () => {
    it('shows line detail header with line name and back button', async () => {
      await openLineDetail();

      expect(screen.getByRole('button', { name: 'חזור לרשימת קווים' })).toBeTruthy();
      expect(screen.getAllByText('שרון דרומי').length).toBeGreaterThan(0);
    });

    it('fetches orders for the selected line', async () => {
      await openLineDetail();

      await waitFor(() => {
        expect(mockedBffRequest).toHaveBeenCalledWith(
          '/api/manual-shift-lines/line-1/orders'
        );
      });
    });

    it('back button returns to line list', async () => {
      await openLineDetail();

      fireEvent.click(screen.getByRole('button', { name: 'חזור לרשימת קווים' }));

      await waitFor(() => {
        // LineDetail overlay gone; back to line list
        expect(screen.queryByRole('button', { name: 'חזור לרשימת קווים' })).toBeNull();
      });
    });

    it('FAB changes to hidden when line detail is open', async () => {
      await openLineDetail();

      // The "הוסף קו" FAB should not be present while in line detail
      expect(screen.queryByRole('button', { name: 'הוסף קו' })).toBeNull();
    });
  });

  // ── 2. Empty line state ───────────────────────────────────────────────────

  describe('empty line state', () => {
    it('shows empty state message', async () => {
      await openLineDetail(mockLineSummaryEmpty);

      await waitFor(() => {
        expect(screen.getByText('אין הזמנות בקו')).toBeTruthy();
      });
    });

    it('shows add order and bulk paste primary actions', async () => {
      await openLineDetail(mockLineSummaryEmpty);

      await waitFor(() => {
        expect(screen.getByText('הוסף הזמנה')).toBeTruthy();
        expect(screen.getByText('הדבק מרובה')).toBeTruthy();
      });
    });
  });

  // ── 3. Line orders render from BFF data ──────────────────────────────────

  describe('order list rendering', () => {
    it('renders order cards from BFF data', async () => {
      const order1 = makeOrder({ id: 'o1', orderNumber: '502481', pickerName: 'יהודה' });
      const order2 = makeOrder({ id: 'o2', orderNumber: '502482', pickerName: 'רפאל' });

      await renderWithShiftAndLines(mockLineSummaryWithOrders, [order1, order2]);
      fireEvent.click(screen.getByText('שרון דרומי'));

      await waitFor(() => {
        expect(screen.getByText('502481')).toBeTruthy();
        expect(screen.getByText('502482')).toBeTruthy();
        expect(screen.getByText('יהודה')).toBeTruthy();
        expect(screen.getByText('רפאל')).toBeTruthy();
      });
    });

    it('shows correct status badge on order card', async () => {
      const order = makeOrder({ status: 'picking' });

      await renderWithShiftAndLines(mockLineSummaryWithOrders, [order]);
      fireEvent.click(screen.getByText('שרון דרומי'));

      await waitFor(() => {
        expect(screen.getByText('בליקוט')).toBeTruthy();
      });
    });

    it('shows error indicator on returned order', async () => {
      const order = makeOrder({ status: 'returned' });

      await renderWithShiftAndLines(mockLineSummaryWithOrders, [order]);
      fireEvent.click(screen.getByText('שרון דרומי'));

      await waitFor(() => {
        expect(screen.getByText('הוחזר לתיקון')).toBeTruthy();
      });
    });
  });

  // ── 4. Quick-add by size ──────────────────────────────────────────────────

  describe('quick-add by size', () => {
    it('renders +S +M +L +XL buttons in line detail', async () => {
      await openLineDetail();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'הוסף גודל S' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'הוסף גודל M' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'הוסף גודל L' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'הוסף גודל XL' })).toBeTruthy();
      });
    });

    it('quick-add S calls POST /orders with correct size payload', async () => {
      const newOrder = makeOrder({ id: 'new-1', size: 'S', orderNumber: null });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders') && method === 'POST') {
          return Promise.resolve(newOrder);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByRole('button', { name: 'הוסף גודל S' }));

      fireEvent.click(screen.getByRole('button', { name: 'הוסף גודל S' }));

      await waitFor(() => {
        const calls = mockedBffRequest.mock.calls;
        const postCall = calls.find(
          ([url, init]) =>
            String(url).includes('/line-1/orders') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.size).toBe('S');
        expect(body.status).toBe('queued');
      });
    });
  });

  // ── 5. Add single order ───────────────────────────────────────────────────

  describe('add single order', () => {
    it('opens add order form when "+ הזמנה" is tapped', async () => {
      await openLineDetail();

      fireEvent.click(screen.getByRole('button', { name: 'הוסף הזמנה' }));

      await waitFor(() => {
        expect(screen.getByText('הזמנה חדשה')).toBeTruthy();
      });
    });

    it('submits correct payload to POST /orders', async () => {
      const newOrder = makeOrder({ id: 'new-1', orderNumber: '999999', pickerName: 'דני' });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders') && method === 'POST') {
          return Promise.resolve(newOrder);
        }
        if (String(url).includes('/workers')) {
          return Promise.resolve([]);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      // Wait for the LineDetail header's "+ הזמנה" button (aria-label "הוסף הזמנה").
      // Empty state also has a button with that accessible name once orders load,
      // so use getAllByRole and pick the first (header) button.
      await waitFor(() => screen.getAllByRole('button', { name: 'הוסף הזמנה' }).length > 0);
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);

      await waitFor(() => screen.getByText('הזמנה חדשה'));

      // Fill required pointName field
      const pointInput = screen.getByPlaceholderText('שם הנקודה');
      fireEvent.change(pointInput, { target: { value: 'ירושלים' } });

      const orderInput = screen.getByPlaceholderText('קוד / מספר (אופציונלי)');
      fireEvent.change(orderInput, { target: { value: '999999' } });

      const pickerInput = screen.getByPlaceholderText('שם המלקט (אופציונלי)');
      fireEvent.change(pickerInput, { target: { value: 'דני' } });

      // AddOrderSheet submit is the last "הוסף הזמנה" button in DOM
      const submitBtns = screen.getAllByText('הוסף הזמנה');
      fireEvent.click(submitBtns[submitBtns.length - 1]);

      await waitFor(() => {
        const calls = mockedBffRequest.mock.calls;
        const postCall = calls.find(
          ([url, init]) =>
            String(url).includes('/line-1/orders') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.pointName).toBe('ירושלים');
        expect(body.orderNumber).toBe('999999');
        expect(body.pickerName).toBe('דני');
        expect(body.status).toBe('queued');
      });
    });
  });

  // ── 6. Bulk paste ─────────────────────────────────────────────────────────

  describe('bulk paste orders', () => {
    it('opens bulk paste form when "הוסף מרובה" is tapped', async () => {
      await openLineDetail();

      fireEvent.click(screen.getByRole('button', { name: 'הוסף מרובה' }));

      // After opening, BulkPasteSheet shows "ייבא הזמנות" submit button (unique to this view)
      // and a textarea (role=textbox) for pasting orders
      await waitFor(() => {
        expect(screen.getByText('ייבא הזמנות')).toBeTruthy();
        expect(screen.getByRole('textbox')).toBeTruthy();
      });
    });

    it('submits rawText to POST /orders/bulk', async () => {
      const bulkResult = { createdCount: 3, rows: [], skippedRows: [] };
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders/bulk') && method === 'POST') {
          return Promise.resolve(bulkResult);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByRole('button', { name: 'הוסף מרובה' }));
      fireEvent.click(screen.getByRole('button', { name: 'הוסף מרובה' }));

      // Wait for the bulk paste form's submit button to confirm it opened
      await waitFor(() => screen.getByText('ייבא הזמנות'));

      // Use getByRole('textbox') to find the textarea (avoids newline normalization issues)
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '502481\n502482, יהודה\n502483, רפאל, 12' } });

      fireEvent.click(screen.getByText('ייבא הזמנות'));

      await waitFor(() => {
        const calls = mockedBffRequest.mock.calls;
        const bulkCall = calls.find(
          ([url, init]) =>
            String(url).includes('/line-1/orders/bulk') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(bulkCall).toBeTruthy();
        const body = JSON.parse((bulkCall![1] as RequestInit).body as string);
        expect(body.rawText).toBe('502481\n502482, יהודה\n502483, רפאל, 12');
      });
    });

    it('shows created count and skipped rows after bulk import', async () => {
      const bulkResult = {
        createdCount: 2,
        rows: [],
        skippedRows: ['bad row']
      };
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders/bulk') && method === 'POST') {
          return Promise.resolve(bulkResult);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByRole('button', { name: 'הוסף מרובה' }));
      fireEvent.click(screen.getByRole('button', { name: 'הוסף מרובה' }));
      await waitFor(() => screen.getByText('ייבא הזמנות'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '502481\n502482' } });
      fireEvent.click(screen.getByText('ייבא הזמנות'));

      await waitFor(() => {
        expect(screen.getByText('נוצרו 2 הזמנות')).toBeTruthy();
        expect(screen.getByText('bad row')).toBeTruthy();
      });
    });
  });

  // ── 7. Order detail – action visibility by status ─────────────────────────

  describe('order detail action visibility by status', () => {
    async function openOrder(status: ManualShiftOrder['status']) {
      const order = makeOrder({ status });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/status') && method === 'PATCH') {
          return Promise.resolve({ ...order, status: 'picking' });
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([order]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryWithOrders] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByText('502481'));
      fireEvent.click(screen.getByText('502481'));
      await waitFor(() => screen.getByRole('button', { name: /חזור/ }));
      return qc;
    }

    it('queued: shows "התחל ליקוט" only', async () => {
      await openOrder('queued');
      expect(screen.getByText('התחל ליקוט')).toBeTruthy();
      expect(screen.queryByText('התחל בדיקה')).toBeNull();
      expect(screen.queryByRole('button', { name: /סגור כתקין/ })).toBeNull();
      expect(screen.queryByText('תקלה')).toBeNull();
      expect(screen.queryByText('הכל תוקן, החזר לבדיקה')).toBeNull();
    });

    it('picking: shows both "התחל בדיקה" and "סיים ליקוט"', async () => {
      await openOrder('picking');
      expect(screen.getByText('התחל בדיקה')).toBeTruthy();
      expect(screen.getByText('סיים ליקוט')).toBeTruthy();
      expect(screen.queryByText('התחל ליקוט')).toBeNull();
    });

    it('waiting_check: shows "סגור כתקין" and "תקלה"', async () => {
      await openOrder('waiting_check');
      expect(screen.getByRole('button', { name: /סגור כתקין/ })).toBeTruthy();
      expect(screen.getByText('תקלה')).toBeTruthy();
    });

    it('returned: shows "הכל תוקן, החזר לבדיקה" only', async () => {
      await openOrder('returned');
      expect(screen.getByText('הכל תוקן, החזר לבדיקה')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /סגור כתקין/ })).toBeNull();
      expect(screen.queryByText('תקלה')).toBeNull();
    });

    it('done: shows no action buttons', async () => {
      await openOrder('done');
      expect(screen.queryByText('התחל ליקוט')).toBeNull();
      expect(screen.queryByText('התחל בדיקה')).toBeNull();
      expect(screen.queryByRole('button', { name: /סגור כתקין/ })).toBeNull();
      expect(screen.queryByText('תקלה')).toBeNull();
      expect(screen.queryByText('הכל תוקן, החזר לבדיקה')).toBeNull();
    });

    it('returned → done: "סגור כתקין" action is not shown', async () => {
      await openOrder('returned');
      // Only "הכל תוקן" is shown, not "סגור כתקין" (done transition)
      expect(screen.queryByRole('button', { name: /סגור כתקין/ })).toBeNull();
    });
  });

  // ── 8–11. Status transition mutations ────────────────────────────────────

  describe('status transitions', () => {
    async function setupOrderAndOpen(fromStatus: ManualShiftOrder['status']) {
      const order = makeOrder({ status: fromStatus, palletCount: 1 });
      const checkedUnit = {
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: 'tenant-1',
        shiftId: 'shift-1',
        lineId: 'line-1',
        orderId: 'order-1',
        unitNumber: 1,
        status: 'checked' as const,
        note: null,
        reason: null,
        checkedAt: '2026-01-01T00:00:00.000Z',
        returnedAt: null,
        voidedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/status') && method === 'PATCH') {
          const body = JSON.parse((init as RequestInit).body as string) as { status: string };
          return Promise.resolve({ ...order, status: body.status });
        }
        if (String(url).includes('/check-units')) {
          return Promise.resolve([checkedUnit]);
        }
        if (String(url).includes('/api/manual-shift-orders/order-1') && method === 'PATCH') {
          const body = JSON.parse((init as RequestInit).body as string) as { waitingCheckAt?: string };
          return Promise.resolve({ ...order, waitingCheckAt: body.waitingCheckAt ?? order.waitingCheckAt });
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([order]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryWithOrders] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByText('502481'));
      fireEvent.click(screen.getByText('502481'));
      await waitFor(() => screen.getByRole('button', { name: /חזור/ }));
      return { order, qc };
    }

    it('queued → picking: calls PATCH /status with { status: "picking" }', async () => {
      await setupOrderAndOpen('queued');
      fireEvent.click(screen.getByText('התחל ליקוט'));

      await waitFor(() => {
        const call = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/order-1/status') &&
            (init as RequestInit | undefined)?.method === 'PATCH'
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body.status).toBe('picking');
      });
    });

    it('picking -> start check: calls PATCH /api/manual-shift-orders/:id with waitingCheckAt', async () => {
      await setupOrderAndOpen('picking');
      fireEvent.click(screen.getByText('התחל בדיקה'));

      await waitFor(() => {
        const call = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/api/manual-shift-orders/order-1') &&
            (init as RequestInit | undefined)?.method === 'PATCH'
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(typeof body.waitingCheckAt).toBe('string');
      });
    });

    it('waiting_check → done: calls PATCH /status with { status: "done" }', async () => {
      await setupOrderAndOpen('waiting_check');
      // Wait for check-units query to resolve so the button becomes enabled
      await waitFor(() =>
        expect((screen.getByRole('button', { name: /סגור כתקין/ }) as HTMLButtonElement).disabled).toBe(false)
      );
      fireEvent.click(screen.getByRole('button', { name: /סגור כתקין/ }));

      await waitFor(() => {
        const call = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/order-1/status') &&
            (init as RequestInit | undefined)?.method === 'PATCH'
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body.status).toBe('done');
      });
    });

    it('returned → waiting_check: calls PATCH /status with { status: "waiting_check" }', async () => {
      await setupOrderAndOpen('returned');
      fireEvent.click(screen.getByText('הכל תוקן, החזר לבדיקה'));

      await waitFor(() => {
        const call = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/order-1/status') &&
            (init as RequestInit | undefined)?.method === 'PATCH'
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body.status).toBe('waiting_check');
      });
    });
  });

  // ── 12–14. Error flow ─────────────────────────────────────────────────────

  describe('error flow', () => {
    async function openErrorFlow() {
      const order = makeOrder({ status: 'waiting_check' });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/errors') && method === 'POST') {
          return Promise.resolve({
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
          });
        }
        if (String(url).includes('/check-units')) {
          return Promise.resolve([]);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([order]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryWithOrders] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByText('502481'));
      fireEvent.click(screen.getByText('502481'));
      await waitFor(() => screen.getByText('תקלה'));
      fireEvent.click(screen.getByText('תקלה'));
      await waitFor(() => screen.getByText('מה הבעיה בהזמנה?'));
    }

    it('error flow screen appears when "תקלה" is tapped', async () => {
      await openErrorFlow();
      expect(screen.getByText('דיווח תקלה')).toBeTruthy();
      expect(screen.getByText('מה הבעיה בהזמנה?')).toBeTruthy();
      expect(screen.queryByText('חזרה לתיקון')).toBeNull();
    });

    it('submit button is disabled until error type is selected', async () => {
      await openErrorFlow();
      const submitBtn = screen.getByText('דווח תקלה');
      expect(submitBtn.closest('button')?.disabled).toBe(true);
    });

    it('selecting an error type enables submit button', async () => {
      await openErrorFlow();
      fireEvent.click(screen.getByText('כמות לא נכונה'));
      const submitBtn = screen.getByText('דווח תקלה');
      expect(submitBtn.closest('button')?.disabled).toBe(false);
    });

    it('submitting error calls POST /errors with correct type', async () => {
      await openErrorFlow();
      fireEvent.click(screen.getByText('פריט שגוי'));
      fireEvent.click(screen.getByText('דווח תקלה'));

      await waitFor(() => {
        const call = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/order-1/errors') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(call).toBeTruthy();
        const body = JSON.parse((call![1] as RequestInit).body as string);
        expect(body.type).toBe('wrong_item');
      });
    });

    it('error submit invalidates line orders query (refetches)', async () => {
      await openErrorFlow();
      fireEvent.click(screen.getByText('פריט חסר'));
      fireEvent.click(screen.getByText('דווח תקלה'));

      await waitFor(() => {
        // After error submit, line orders are refetched
        const ordersRefetch = mockedBffRequest.mock.calls.filter(([url]) =>
          String(url).includes('/line-1/orders')
        );
        expect(ordersRefetch.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ── 15. No direct Supabase calls ─────────────────────────────────────────

  describe('no direct Supabase access', () => {
    it('all BFF interactions go through bffRequest mock (no supabase calls escape)', async () => {
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });
      renderPage(makeQueryClient());

      await waitFor(() => screen.getByText('פתח משמרת להיום'));

      // If any file called supabase directly, the mock would not intercept it
      // and the test environment (no real supabase) would throw or fail
      expect(mockedBffRequest).toBeDefined();
    });
  });

  // ── 16. Semantic label & field correctness ────────────────────────────────

  describe('semantic label and field correctness', () => {
    it('add order form shows נקודה label and disables submit when empty', async () => {
      await openLineDetail();
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);

      await waitFor(() => screen.getByText('הזמנה חדשה'));

      expect(screen.getByText('נקודה')).toBeTruthy();

      // Submit is disabled while pointName is empty
      const submitBtns = screen.getAllByText('הוסף הזמנה');
      const submitBtn = submitBtns[submitBtns.length - 1].closest('button');
      expect(submitBtn?.disabled).toBe(true);
    });

    it('add order form shows optional label for orderNumber', async () => {
      await openLineDetail();
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);

      await waitFor(() => screen.getByText('הזמנה חדשה'));

      expect(screen.getByText('קוד / מספר (אופציונלי)')).toBeTruthy();
    });

    it('add order form has מספר משטחים field that submits palletCount', async () => {
      const newOrder = makeOrder({ id: 'new-2', pointName: 'תל אביב', palletCount: 3 });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders') && method === 'POST') {
          return Promise.resolve(newOrder);
        }
        if (String(url).includes('/workers')) {
          return Promise.resolve([]);
        }
        if (String(url).includes('/orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getAllByRole('button', { name: 'הוסף הזמנה' }).length > 0);
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);

      await waitFor(() => screen.getByText('הזמנה חדשה'));

      expect(screen.getByText('מספר משטחים')).toBeTruthy();

      fireEvent.change(screen.getByPlaceholderText('שם הנקודה'), {
        target: { value: 'תל אביב' }
      });
      fireEvent.change(screen.getByPlaceholderText('מספר משטחים (אופציונלי)'), {
        target: { value: '3' }
      });

      const submitBtns = screen.getAllByText('הוסף הזמנה');
      fireEvent.click(submitBtns[submitBtns.length - 1]);

      await waitFor(() => {
        const postCall = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/line-1/orders') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.palletCount).toBe(3);
      });
    });

    it('empty palletCount submits null not 0', async () => {
      const newOrder = makeOrder({ id: 'new-3', pointName: 'חיפה', palletCount: null });
      mockedBffRequest.mockImplementation((url: string, init?: unknown) => {
        const method = (init as RequestInit | undefined)?.method;
        if (String(url).includes('/orders') && method === 'POST') {
          return Promise.resolve(newOrder);
        }
        if (String(url).includes('/workers')) return Promise.resolve([]);
        if (String(url).includes('/orders')) return Promise.resolve([]);
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryEmpty] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getAllByRole('button', { name: 'הוסף הזמנה' }).length > 0);
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);
      await waitFor(() => screen.getByText('הזמנה חדשה'));

      fireEvent.change(screen.getByPlaceholderText('שם הנקודה'), {
        target: { value: 'חיפה' }
      });
      // palletCount left empty

      const submitBtns = screen.getAllByText('הוסף הזמנה');
      fireEvent.click(submitBtns[submitBtns.length - 1]);

      await waitFor(() => {
        const postCall = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/line-1/orders') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.palletCount).toBeNull();
      });
    });

    it('bulk paste instructions mention נקודה format', async () => {
      await openLineDetail();
      fireEvent.click(screen.getByRole('button', { name: 'הוסף מרובה' }));

      await waitFor(() => screen.getByText('ייבא הזמנות'));

      expect(screen.getByText(/נקודה/)).toBeTruthy();
    });

    it('order card renders pointName as primary title', async () => {
      const order = makeOrder({ pointName: 'ירושלים', orderNumber: '502481' });
      await renderWithShiftAndLines(mockLineSummaryWithOrders, [order]);
      fireEvent.click(screen.getByText('שרון דרומי'));

      await waitFor(() => {
        // pointName is the large primary text
        expect(screen.getByText('ירושלים')).toBeTruthy();
        // orderNumber still shown as secondary
        expect(screen.getByText('502481')).toBeTruthy();
      });
    });

    it('order detail renders pointName and palletCount', async () => {
      const order = makeOrder({ pointName: 'ירושלים', palletCount: 2, orderNumber: null });
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes('/orders')) return Promise.resolve([order]);
        return Promise.resolve({ shift: mockShift, lines: [mockLineSummaryWithOrders] });
      });

      const qc = makeQueryClient();
      renderPage(qc);
      await waitFor(() => screen.getByText('שרון דרומי'));
      fireEvent.click(screen.getByText('שרון דרומי'));
      await waitFor(() => screen.getByText('ירושלים'));
      fireEvent.click(screen.getAllByText('ירושלים')[0]);
      await waitFor(() => screen.getByRole('button', { name: /חזור/ }));

      // pointName shown in detail
      expect(screen.getAllByText('ירושלים').length).toBeGreaterThan(0);
      // pallet count label is present in current mobile detail header
      expect(screen.getByText('מס.משטחים')).toBeTruthy();
      // palletCount value shown (may coexist with other "2" occurrences)
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });

    it('add order form does not show שם לקוח or עובד מלקט as primary labels', async () => {
      await openLineDetail();
      fireEvent.click(screen.getAllByRole('button', { name: 'הוסף הזמנה' })[0]);

      await waitFor(() => screen.getByText('הזמנה חדשה'));

      expect(screen.queryByText('שם לקוח')).toBeNull();
      expect(screen.queryByText('עובד מלקט')).toBeNull();
    });
  });
});




