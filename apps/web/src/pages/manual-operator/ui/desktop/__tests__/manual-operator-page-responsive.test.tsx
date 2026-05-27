import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock bffRequest before importing the page
vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

// Mock useMediaQuery so tests control viewport
vi.mock('@/shared/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn()
}));

import { bffRequest } from '@/shared/api/bff/client';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { ManualOperatorPage } from '../../manual-operator-page';

const mockedBffRequest = vi.mocked(bffRequest);
const mockUseMediaQuery = vi.mocked(useMediaQuery);

const mockShift = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-05-27',
  name: 'משמרת בוקר',
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

function makeQC() {
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

describe('ManualOperatorPage responsive rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mobile path (isDesktop=false)', () => {
    it('renders mobile shell with bottom nav when viewport is narrow', async () => {
      mockUseMediaQuery.mockReturnValue(false);
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

      renderPage(makeQC());

      // Mobile shell bottom nav is always present
      expect(screen.getByRole('button', { name: 'תור' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'בדיקה' })).toBeTruthy();
    });

    it('does not render desktop panels on mobile', async () => {
      mockUseMediaQuery.mockReturnValue(false);
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

      renderPage(makeQC());

      // Desktop-specific panel headers should not appear
      expect(screen.queryByText('קווים')).toBeNull();
      expect(screen.queryByText('מלקטים')).toBeNull();
    });

    it('mobile empty state renders when shift is null', async () => {
      mockUseMediaQuery.mockReturnValue(false);
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

      renderPage(makeQC());

      await waitFor(() => {
        expect(screen.getByText('אין משמרת פעילה')).toBeTruthy();
      });
    });
  });

  describe('desktop path (isDesktop=true)', () => {
    it('renders desktop shell with shift name and picker panel when viewport is wide', async () => {
      mockUseMediaQuery.mockReturnValue(true);
      mockedBffRequest.mockImplementation((url: string) => {
        if (url.includes('/day-summary')) return Promise.resolve(emptyDaySummary);
        if (url.includes('/orders')) return Promise.resolve([]);
        return Promise.resolve({ shift: mockShift, lines: [] });
      });

      renderPage(makeQC());

      await waitFor(() => {
        // Shift name always appears in desktop header
        expect(screen.getByText('משמרת בוקר')).toBeTruthy();
        // Picker panel header always renders regardless of picker count
        expect(screen.getByText('מלקטים')).toBeTruthy();
      });
    });

    it('does not render mobile bottom nav on desktop', async () => {
      mockUseMediaQuery.mockReturnValue(true);
      mockedBffRequest.mockImplementation((url: string) => {
        if (url.includes('/day-summary')) return Promise.resolve(emptyDaySummary);
        if (url.includes('/orders')) return Promise.resolve([]);
        return Promise.resolve({ shift: mockShift, lines: [] });
      });

      renderPage(makeQC());

      await waitFor(() => {
        // Picker panel header always renders on desktop — confirms shell is mounted
        expect(screen.getByText('מלקטים')).toBeTruthy();
      });

      expect(screen.queryByRole('button', { name: 'תור' })).toBeNull();
    });

    it('renders desktop empty state when shift is null on desktop', async () => {
      mockUseMediaQuery.mockReturnValue(true);
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

      renderPage(makeQC());

      await waitFor(() => {
        expect(screen.getByText('אין משמרת פעילה')).toBeTruthy();
        // Desktop empty state has subtitle text
        expect(screen.getByText('פתח משמרת כדי להתחיל לעקוב אחר ההזמנות')).toBeTruthy();
      });
    });
  });
});
