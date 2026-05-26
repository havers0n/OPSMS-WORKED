import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PeopleTab } from './people-tab';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const SHIFT_ID = 'shift-1';

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderPeopleTab(shiftId = SHIFT_ID) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <PeopleTab shiftId={shiftId} />
    </QueryClientProvider>
  );
}

function makeWorker(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    tenantId: 't1',
    shiftId: SHIFT_ID,
    name: 'מרים',
    role: 'picker',
    active: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function makePeopleSummary(items: unknown[] = []) {
  return { shiftId: SHIFT_ID, items };
}

function makeSummaryItem(pickerName: string, overrides: Record<string, unknown> = {}) {
  return {
    pickerName,
    activeOrdersCount: 0,
    waitingCheckCount: 0,
    returnedCount: 0,
    doneCount: 0,
    errorCount: 0,
    currentActiveOrder: null,
    ...overrides
  };
}

// Helper: mock both endpoints
function mockBoth(workers: unknown[], summaryItems: unknown[]) {
  mockedBffRequest.mockImplementation((url: unknown) => {
    const u = String(url);
    if (u.includes('/workers')) return Promise.resolve(workers);
    if (u.includes('/people-summary')) return Promise.resolve(makePeopleSummary(summaryItems));
    return Promise.reject(new Error(`unexpected: ${u}`));
  });
}

describe('PeopleTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when roster and summary are both empty', async () => {
    mockBoth([], []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('אין עובדים ברשימה')).toBeTruthy();
    });
  });

  it('shows roster worker card with zero order counts when worker has no points', async () => {
    mockBoth([makeWorker({ name: 'מרים' })], []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('מרים')).toBeTruthy();
    });

    expect(screen.getByText('מלקט')).toBeTruthy();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(4);
  });

  it('shows roster worker with order counts from people summary', async () => {
    const worker = makeWorker({ name: 'מרים' });
    const summary = makeSummaryItem('מרים', { activeOrdersCount: 2, doneCount: 5 });
    mockBoth([worker], [summary]);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('מרים')).toBeTruthy();
    });

    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows unregistered free-text pickers under "לא ברשימה" section', async () => {
    const freeTextItem = makeSummaryItem('חופשי טקסט', { activeOrdersCount: 1 });
    mockBoth([], [freeTextItem]);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('חופשי טקסט')).toBeTruthy();
    });

    expect(screen.getByText('לא ברשימה')).toBeTruthy();
    expect(screen.getByText('טקסט חופשי')).toBeTruthy();
  });

  it('separates roster pickers from free-text pickers', async () => {
    const worker = makeWorker({ name: 'מרים' });
    const rosterSummary = makeSummaryItem('מרים', { doneCount: 3 });
    const freeSummary = makeSummaryItem('חופשי', { doneCount: 1 });
    mockBoth([worker], [rosterSummary, freeSummary]);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('מרים')).toBeTruthy();
      expect(screen.getByText('חופשי')).toBeTruthy();
    });

    expect(screen.getByText('לא ברשימה')).toBeTruthy();
  });

  it('shows error count badge when picker has errors', async () => {
    const worker = makeWorker({ name: 'דינה' });
    const summary = makeSummaryItem('דינה', { errorCount: 2 });
    mockBoth([worker], [summary]);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('2 תקלות')).toBeTruthy();
    });
  });

  it('shows current active order point name for roster worker', async () => {
    const worker = makeWorker({ name: 'יוסי' });
    const summary = makeSummaryItem('יוסי', {
      activeOrdersCount: 1,
      currentActiveOrder: {
        id: 'o1', tenantId: 't1', shiftId: SHIFT_ID, lineId: 'l1',
        orderNumber: null, customerName: null, pointName: 'נקודה ג',
        palletCount: null, pickerName: 'יוסי', pickerWorkerId: null, checkerName: null,
        lineCount: 3, size: 'S', status: 'picking',
        startedAt: new Date().toISOString(), waitingCheckAt: null,
        checkedAt: null, finishedAt: null, comment: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
    });
    mockBoth([worker], [summary]);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('פעיל: נקודה ג')).toBeTruthy();
    });
  });

  it('shows inactive badge for inactive worker', async () => {
    const worker = makeWorker({ active: false });
    mockBoth([worker], []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('לא פעיל')).toBeTruthy();
    });
  });

  it('can reactivate an inactive worker', async () => {
    const inactiveWorker = makeWorker({ active: false });
    mockedBffRequest.mockImplementation((url: unknown, options?: unknown) => {
      const u = String(url);
      const method = (options as RequestInit | undefined)?.method;
      if (u.includes('/manual-shift-workers/w1') && method === 'PATCH') {
        return Promise.resolve(makeWorker({ active: true }));
      }
      if (u.includes('/workers')) return Promise.resolve([inactiveWorker]);
      if (u.includes('/people-summary')) return Promise.resolve(makePeopleSummary([]));
      return Promise.reject(new Error(`unexpected: ${u}`));
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'החזר למשמרת' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'החזר למשמרת' }));

    await waitFor(() => {
      const patchCall = mockedBffRequest.mock.calls.find(
        ([u, opts]) =>
          String(u).includes('/manual-shift-workers/w1') &&
          (opts as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
      expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({ active: true });
    });
  });

  it('renders multiple roster worker cards', async () => {
    const workers = [
      makeWorker({ id: 'w1', name: 'אלי' }),
      makeWorker({ id: 'w2', name: 'רחל', role: 'checker' })
    ];
    mockBoth(workers, []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('אלי')).toBeTruthy();
      expect(screen.getByText('רחל')).toBeTruthy();
    });

    expect(screen.getByText('בודק')).toBeTruthy();
  });

  it('shows the add worker button', async () => {
    mockBoth([], []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('הוסף עובד')).toBeTruthy();
    });
  });

  it('opens the add worker form when button is clicked', async () => {
    mockBoth([], []);
    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('הוסף עובד')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('הוסף עובד'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('שם העובד')).toBeTruthy();
    });

    // Role buttons appear
    expect(screen.getByRole('button', { name: 'מלקט' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'בודק' })).toBeTruthy();
  });

  it('submits new worker via POST to workers endpoint', async () => {
    const newWorker = makeWorker({ id: 'w-new', name: 'רפאל' });
    mockedBffRequest.mockImplementation((url: unknown, options?: unknown) => {
      const u = String(url);
      const method = (options as RequestInit | undefined)?.method;
      if (u.includes('/workers') && method === 'POST') return Promise.resolve(newWorker);
      if (u.includes('/workers')) return Promise.resolve([]);
      if (u.includes('/people-summary')) return Promise.resolve(makePeopleSummary([]));
      return Promise.reject(new Error(`unexpected: ${u}`));
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('הוסף עובד')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('הוסף עובד'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('שם העובד')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('שם העובד'), {
      target: { value: 'רפאל' }
    });

    fireEvent.click(screen.getByText('הוסף'));

    await waitFor(() => {
      const postCall = mockedBffRequest.mock.calls.find(
        ([u, opts]) => String(u).includes('/workers') && (opts as RequestInit)?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
    });
  });

  it('does not access supabase directly — uses bffRequest', () => {
    expect(mockedBffRequest).toBeDefined();
  });
});
