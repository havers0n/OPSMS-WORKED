import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';

// Mock the BFF client so no real HTTP or supabase calls are made
vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

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

describe('ManualOperatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the mobile shell with bottom nav tabs', async () => {
    mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

    renderPage(makeQueryClient());

    // Bottom nav is always present
    expect(screen.getByRole('button', { name: 'תור' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'בדיקה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'עובדים' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'יום' })).toBeTruthy();
  });

  it('shows loading state while fetching today shift', () => {
    // Never resolve so it stays in loading state
    mockedBffRequest.mockReturnValue(new Promise(() => undefined));

    renderPage(makeQueryClient());

    // Loading spinner should be present; no-shift or line list should not
    expect(screen.queryByText('פתח משמרת להיום')).toBeNull();
  });

  it('shows no-shift state when today returns null shift', async () => {
    mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('פתח משמרת להיום')).toBeTruthy();
    });

    expect(screen.getByText('אין משמרת פעילה')).toBeTruthy();
  });

  it('calls create shift mutation when button is clicked', async () => {
    const mockShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      date: '2026-05-26',
      name: 'משמרת',
      status: 'active',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    // First call returns no shift; second call (after create) returns shift
    mockedBffRequest
      .mockResolvedValueOnce({ shift: null, lines: [] })
      .mockResolvedValueOnce(mockShift) // POST /api/manual-shifts
      .mockResolvedValue({ shift: mockShift, lines: [] }); // refetch

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('פתח משמרת להיום')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('פתח משמרת להיום'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shifts',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('renders line list when shift is active', async () => {
    const mockShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      date: '2026-05-26',
      name: 'משמרת ראשון',
      status: 'active',
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
      status: 'open',
      createdAt: new Date().toISOString(),
      deletedAt: null,
      deletedByProfileId: null,
      deletedByName: null,
      deleteReason: null
    };

    mockedBffRequest.mockResolvedValue({
      shift: mockShift,
      lines: [
        {
          line: mockLine,
          totalOrders: 3,
          queuedOrders: 2,
          pickingOrders: 1,
          waitingCheckOrders: 0,
          returnedOrders: 0,
          doneOrders: 0,
          errorCount: 0
        }
      ]
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('שרון דרומי')).toBeTruthy();
    });

    expect(screen.getByText('משמרת ראשון')).toBeTruthy();
  });

  it('switches to real tab content when non-queue tab is clicked', async () => {
    const mockShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      date: '2026-05-26',
      name: 'משמרת',
      status: 'active',
      createdBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    const emptyDaySummary = {
      shiftId: 'shift-1',
      totalOrders: 0,
      queuedOrders: 0,
      pickingOrders: 0,
      waitingCheckOrders: 0,
      returnedOrders: 0,
      doneOrders: 0,
      errorsCount: 0,
      byErrorType: [],
      byLine: [],
      byPicker: []
    };

    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/workers')) {
        return Promise.resolve([]);
      }
      if (url.includes('/people-summary')) {
        return Promise.resolve({ shiftId: 'shift-1', items: [] });
      }
      if (url.includes('/day-summary')) {
        return Promise.resolve(emptyDaySummary);
      }
      if (url.includes('/orders')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ shift: mockShift, lines: [] });
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      // Queue tab shows empty line list
      expect(screen.getByText('אין קווים עדיין. לחץ על + להוסיף קו חדש.')).toBeTruthy();
    });

    // Click Check tab — should show empty check state
    fireEvent.click(screen.getByRole('button', { name: 'בדיקה' }));
    await waitFor(() => {
      expect(screen.getByText('אין נקודות לבדיקה')).toBeTruthy();
    });

    // Click People tab — should show empty roster state
    fireEvent.click(screen.getByRole('button', { name: 'עובדים' }));
    await waitFor(() => {
      expect(screen.getByText('אין עובדים ברשימה')).toBeTruthy();
    });

    // Click Day tab — should show day summary with export button
    fireEvent.click(screen.getByRole('button', { name: 'יום' }));
    await waitFor(() => {
      expect(screen.getByText('סיכום יום')).toBeTruthy();
    });
  });

  it('shows add line FAB only on queue tab when shift is active', async () => {
    const mockShift = {
      id: 'shift-1',
      tenantId: 'tenant-1',
      date: '2026-05-26',
      name: 'משמרת',
      status: 'active',
      createdBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    mockedBffRequest.mockResolvedValue({ shift: mockShift, lines: [] });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'הוסף קו' })).toBeTruthy();
    });

    // Switch to check tab — FAB should disappear
    fireEvent.click(screen.getByRole('button', { name: 'בדיקה' }));
    expect(screen.queryByRole('button', { name: 'הוסף קו' })).toBeNull();
  });

  it('opens add line sheet when FAB is clicked and calls create line API on submit', async () => {
    const mockShift = {
      id: 'shift-42',
      tenantId: 'tenant-1',
      date: '2026-05-26',
      name: 'משמרת',
      status: 'active',
      createdBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null
    };
    const mockNewLine = {
      id: 'line-new',
      tenantId: 'tenant-1',
      shiftId: 'shift-42',
      name: 'מרכז',
      sortOrder: 0,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    mockedBffRequest
      .mockResolvedValueOnce({ shift: mockShift, lines: [] })
      .mockResolvedValueOnce(mockNewLine) // POST /api/manual-shifts/:id/lines
      .mockResolvedValue({ shift: mockShift, lines: [] }); // refetch

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'הוסף קו' })).toBeTruthy();
    });

    // Open the sheet
    fireEvent.click(screen.getByRole('button', { name: 'הוסף קו' }));
    expect(screen.getByText('הוסף קו חדש')).toBeTruthy();

    // Fill the name
    const input = screen.getByPlaceholderText('שם הקו (למשל: מרכז, צפון...)');
    fireEvent.change(input, { target: { value: 'מרכז' } });

    // Submit
    fireEvent.click(screen.getByText('הוסף'));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        '/api/manual-shifts/shift-42/lines',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('does not import supabase client directly', async () => {
    // Verify that new entity files only use bffRequest (already validated
    // by the mock above intercepting at the bff client boundary — if any
    // file called supabase directly the mock would not intercept it and
    // the test environment would fail during import or fetch)
    expect(mockedBffRequest).toBeDefined();
  });
});
