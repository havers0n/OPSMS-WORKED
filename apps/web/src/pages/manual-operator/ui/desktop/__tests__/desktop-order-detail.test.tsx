import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OrderDetail } from '@/entities/manual-shift/model/shift-selectors';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { DesktopOrderDetail } from '../desktop-order-detail';
import { mockOrderDetail } from './fixtures';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
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

function makeOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderId: 'order-1',
    sku: 'SKU-1',
    description: 'Desktop product',
    category: 'Cat A',
    quantity: 4,
    notes: 'Note A',
    zone: 'Z1',
    sourceSheet: 'Sheet1',
    sourceRows: [2, 4],
    sourceFile: 'monthly.xlsx',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

function renderDetail(detail: OrderDetail | null = mockOrderDetail) {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <DesktopOrderDetail detail={detail} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('DesktopOrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders order detail fields', () => {
    renderDetail();
    expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('קו צפון').length).toBeGreaterThan(0);
    expect(screen.getAllByText('נקודה א').length).toBeGreaterThan(0);
    expect(screen.getByText('דוד')).toBeTruthy();
  });

  it('renders status badge', () => {
    renderDetail();
    const statuses = screen.getAllByText('בליקוט');
    expect(statuses.some((el) => el.className.includes('rounded-full'))).toBe(true);
  });

  it('renders section headings', () => {
    renderDetail();
    expect(screen.getByText('פרטי ההזמנה')).toBeTruthy();
    expect(screen.getByText('עבודה')).toBeTruthy();
    expect(screen.getByText('זמנים')).toBeTruthy();
  });

  it('shows parallel check indicator when status is picking and checkStartedAt exists', () => {
    renderDetail({
      ...mockOrderDetail,
      status: 'picking',
      checkStartedAt: new Date(Date.now() - 120_000).toISOString()
    });

    expect(screen.getByText(/בדיקה במקביל/i)).toBeTruthy();
  });

  it('parallel check indicator does not replace status age row', () => {
    renderDetail({
      ...mockOrderDetail,
      status: 'picking',
      ageSeconds: 180,
      checkStartedAt: new Date(Date.now() - 120_000).toISOString()
    });

    expect(screen.getByText('גיל סטטוס')).toBeTruthy();
    expect(screen.getByText(/בדיקה במקביל/i)).toBeTruthy();
  });

  it('renders localized timestamp as DD.MM.YYYY · HH:mm with ltr direction and not raw ISO', () => {
    const rawIso = '2026-05-26T23:57:41.345065+00:00';
    const expected = formatDateTimeHe(rawIso);
    renderDetail({ ...mockOrderDetail, createdAt: rawIso });

    expect(expected).toMatch(/^\d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}$/);

    const timestampValue = screen.getByText(expected);
    expect(timestampValue.getAttribute('dir')).toBe('ltr');
    expect(screen.queryByText(rawIso)).toBeNull();
  });

  it('renders dash for null timestamp', () => {
    renderDetail({ ...mockOrderDetail, startedAt: null });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders checkStartedAt absolute timestamp in times section', () => {
    const checkStartedAt = '2026-05-27T09:20:00.000Z';
    renderDetail({ ...mockOrderDetail, checkStartedAt });

    expect(screen.getByText('הבדיקה התחילה')).toBeTruthy();
    expect(screen.getByText(formatDateTimeHe(checkStartedAt))).toBeTruthy();
  });

  it('renders dash for invalid timestamp', () => {
    renderDetail({ ...mockOrderDetail, startedAt: 'not-a-date' });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('not-a-date')).toBeNull();
  });

  it('renders dash when age is null', () => {
    renderDetail({ ...mockOrderDetail, ageSeconds: null, status: 'returned' });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders stale not-found state when detail is null', () => {
    renderDetail(null);
    expect(screen.getByText(/ההזמנה שנבחרה אינה זמינה יותר/i)).toBeTruthy();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <DesktopOrderDetail detail={null} onClose={onClose} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /סגור|close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders imported products table and summary badges', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/items') && method === 'GET') {
        return [makeOrderItem()];
      }
      return [];
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('מוצרים בהזמנה')).toBeTruthy();
      expect(screen.getByText('SKU-1')).toBeTruthy();
      expect(screen.getByText('Desktop product')).toBeTruthy();
      expect(screen.getByText('Cat A')).toBeTruthy();
      expect(screen.getByText('Note A')).toBeTruthy();
      expect(screen.getByText('2, 4')).toBeTruthy();
    });
  });

  it('shows empty state when there are no imported items', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/items') && method === 'GET') {
        return [];
      }
      return [];
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('אין מוצרים להזמנה זו.')).toBeTruthy();
    });
  });

  it('shows inline error when items request fails', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/items') && method === 'GET') {
        throw new Error('failed');
      }
      return [];
    });

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('לא ניתן לטעון את פריטי ההזמנה.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeTruthy();
    });
  });

  it('shows loading state while items request is pending', async () => {
    const pending = new Promise(() => {});
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/items') && method === 'GET') {
        return pending;
      }
      return [];
    });

    renderDetail();

    expect(screen.getByText('טוען מוצרים...')).toBeTruthy();
  });
});
