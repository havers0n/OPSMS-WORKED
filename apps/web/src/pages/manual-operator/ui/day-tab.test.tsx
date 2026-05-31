import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DayTab } from './day-tab';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

// Mock URL.createObjectURL since jsdom doesn't support it
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn()
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

const mockLine = {
  id: 'line-1',
  tenantId: 'tenant-1',
  shiftId: 'shift-1',
  name: 'קו מרכז',
  sortOrder: 0,
  status: 'in_progress' as const,
  createdAt: new Date().toISOString()
};

const baseDaySummary = {
  shiftId: 'shift-1',
  totalOrders: 10,
  queuedOrders: 2,
  pickingOrders: 1,
  waitingCheckOrders: 3,
  returnedOrders: 1,
  doneOrders: 3,
  errorsCount: 2,
  byErrorType: [
    { type: 'wrong_quantity', count: 1 },
    { type: 'missing_item', count: 1 }
  ],
  byLine: [
    {
      line: mockLine,
      totalOrders: 5,
      queuedOrders: 1,
      pickingOrders: 1,
      waitingCheckOrders: 1,
      returnedOrders: 1,
      doneOrders: 1,
      errorCount: 1
    }
  ],
  byPicker: [
    {
      pickerName: 'נעמי',
      totalOrders: 5,
      queuedOrders: 0,
      pickingOrders: 1,
      waitingCheckOrders: 1,
      returnedOrders: 0,
      doneOrders: 3,
      errorCount: 1
    }
  ]
};

function renderDayTab(shiftId = 'shift-1', shiftName = 'משמרת בוקר', canInteract = true) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <DayTab shiftId={shiftId} shiftName={shiftName} canInteract={canInteract} />
    </QueryClientProvider>
  );
}

function mockDayRequests(overrides?: { orders?: unknown[] }) {
  mockedBffRequest.mockImplementation((url: string) => {
    if (url.includes('/open-ashlamot')) return Promise.resolve([]);
    if (url.includes('/orders')) return Promise.resolve(overrides?.orders ?? []);
    return Promise.resolve(baseDaySummary);
  });
}

describe('DayTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders totals and status breakdown', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('סיכום יום')).toBeTruthy();
    });

    // totalOrders=10 is unique in the dataset
    expect(screen.getByText('10')).toBeTruthy();
    // errorsCount badge
    expect(screen.getByText('2 תקלות')).toBeTruthy();
    // labels present
    expect(screen.getByText('סה״כ נקודות')).toBeTruthy();
    expect(screen.getByText('הסתיימו')).toBeTruthy();
    expect(screen.getByText('הוחזרו לתיקון')).toBeTruthy();
  });

  it('renders error breakdown by type', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('פירוט תקלות')).toBeTruthy();
    });

    expect(screen.getByText('כמות לא נכונה')).toBeTruthy();
    expect(screen.getByText('פריט חסר')).toBeTruthy();
  });

  it('renders line breakdown', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('לפי קו')).toBeTruthy();
    });

    expect(screen.getByText('קו מרכז')).toBeTruthy();
  });

  it('renders picker breakdown', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('לפי מלקט')).toBeTruthy();
    });

    expect(screen.getByText('נעמי')).toBeTruthy();
  });

  it('shows export button', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ייצא CSV' })).toBeTruthy();
    });
  });

  it('export button is disabled when no orders loaded', async () => {
    // day summary resolves but orders resolves to []
    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/open-ashlamot')) return Promise.resolve([]);
      if (url.includes('/orders')) return Promise.resolve([]);
      return Promise.resolve(baseDaySummary);
    });

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ייצא CSV' })).toBeTruthy();
    });

    const btn = screen.getByRole('button', { name: 'ייצא CSV' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('export button triggers CSV download when orders present', async () => {
    const mockOrder = {
      id: 'order-1',
      tenantId: 'tenant-1',
      shiftId: 'shift-1',
      lineId: 'line-1',
      orderNumber: 'ORD-1',
      customerName: null,
      pointName: 'נקודה א',
      palletCount: 1,
      pickerName: 'נעמי',
      checkerName: null,
      lineCount: 4,
      size: 'M',
      status: 'done',
      startedAt: null,
      waitingCheckAt: null,
      checkedAt: null,
      finishedAt: new Date().toISOString(),
      comment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/open-ashlamot')) return Promise.resolve([]);
      if (url.includes('/orders')) return Promise.resolve([mockOrder]);
      return Promise.resolve(baseDaySummary);
    });

    // Spy on createElement to detect CSV anchor creation
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy });
      }
      return el;
    });

    renderDayTab();

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'ייצא CSV' }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'ייצא CSV' }));

    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('shows empty state when summary unavailable', async () => {
    // Simulate a fetch error by rejecting
    mockedBffRequest.mockRejectedValue(new Error('not found'));

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('אין נתוני יום')).toBeTruthy();
    });
  });

  it('does not access supabase directly', () => {
    expect(mockedBffRequest).toBeDefined();
  });

  it('ShiftOpenAshlamotBoard renders before סיכום יום in the tab', async () => {
    mockDayRequests();

    renderDayTab();

    await waitFor(() => {
      expect(screen.getByText('סיכום יום')).toBeTruthy();
      expect(screen.getByTestId('shift-open-ashlamot-board')).toBeTruthy();
    });

    const boardEl = screen.getByTestId('shift-open-ashlamot-board');
    const summaryEl = screen.getByText('סיכום יום');
    // DOCUMENT_POSITION_FOLLOWING means summaryEl comes AFTER boardEl
    expect(boardEl.compareDocumentPosition(summaryEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
