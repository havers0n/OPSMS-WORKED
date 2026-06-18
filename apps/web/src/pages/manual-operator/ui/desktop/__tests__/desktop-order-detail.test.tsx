import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { DesktopOrderDetail } from '../desktop-order-detail';
import { mockOrderDetail } from './fixtures';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

const mockedBffRequest = vi.mocked(bffRequest);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function renderDetail(detail = mockOrderDetail) {
  const queryClient = makeQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <DesktopOrderDetail detail={detail} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('DesktopOrderDetail', () => {
  it('renders items and computed totals when order detail has items', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith(`/manual-shift-orders/${mockOrderDetail.orderId}`) && (init?.method ?? 'GET') === 'GET') {
        return {
          ...mockOrderDetail,
          lineCount: 2,
          totalQuantity: 32,
          items: [
            {
              id: '11111111-1111-4111-8111-111111111112',
              tenantId: 'tenant-1',
              shiftId: 'shift-1',
              lineId: mockOrderDetail.lineId,
              orderId: mockOrderDetail.orderId,
              sku: 'SKU-1',
              description: 'Item 1',
              category: 'Frozen',
              quantity: 12,
              notes: 'Fragile',
              zone: 'North',
              sourceSheet: null,
              sourceRows: [1],
              sourceFile: null,
              sortOrder: 1,
              createdAt: '2026-05-27T08:00:00.000Z'
            },
            {
              id: '11111111-1111-4111-8111-111111111113',
              tenantId: 'tenant-1',
              shiftId: 'shift-1',
              lineId: mockOrderDetail.lineId,
              orderId: mockOrderDetail.orderId,
              sku: 'SKU-2',
              description: 'Item 2',
              category: null,
              quantity: 20,
              notes: null,
              zone: null,
              sourceSheet: null,
              sourceRows: [2],
              sourceFile: null,
              sortOrder: 2,
              createdAt: '2026-05-27T08:01:00.000Z'
            }
          ]
        };
      }
      return [];
    });

    renderDetail();
    await waitFor(() => expect(screen.getByText('פריטי הזמנה')).toBeTruthy());
    const itemsSection = screen.getByTestId('order-items-section');
    expect(screen.getAllByText('כמות כוללת').length).toBeGreaterThan(0);
    expect(within(itemsSection).getAllByText('32').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('order-secondary-section')).queryByText('שורות')).toBeNull();
  });

  it('renders items section before secondary metadata and times sections', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith(`/manual-shift-orders/${mockOrderDetail.orderId}`) && (init?.method ?? 'GET') === 'GET') {
        return {
          ...mockOrderDetail,
          lineCount: 1,
          totalQuantity: 5,
          items: [
            {
              id: '11111111-1111-4111-8111-111111111114',
              tenantId: 'tenant-1',
              shiftId: 'shift-1',
              lineId: mockOrderDetail.lineId,
              orderId: mockOrderDetail.orderId,
              sku: 'SKU-3',
              description: 'Item 3',
              category: null,
              quantity: 5,
              notes: null,
              zone: null,
              sourceSheet: null,
              sourceRows: [1],
              sourceFile: null,
              sortOrder: 1,
              createdAt: '2026-05-27T08:00:00.000Z'
            }
          ]
        };
      }
      return [];
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('order-items-section')).toBeTruthy());

    const itemsSection = screen.getByTestId('order-items-section');
    const secondarySection = screen.getByTestId('order-secondary-section');
    const timesSection = screen.getByTestId('order-times-section');

    expect(itemsSection.compareDocumentPosition(secondarySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(secondarySection.compareDocumentPosition(timesSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders additive item metadata when present', async () => {
    mockedBffRequest.mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith(`/manual-shift-orders/${mockOrderDetail.orderId}`) && (init?.method ?? 'GET') === 'GET') {
        return {
          ...mockOrderDetail,
          lineCount: 1,
          totalQuantity: 5,
          items: [
            {
              id: '11111111-1111-4111-8111-111111111115',
              tenantId: 'tenant-1',
              shiftId: 'shift-1',
              lineId: mockOrderDetail.lineId,
              orderId: mockOrderDetail.orderId,
              sku: 'SKU-4',
              description: 'Item 4',
              category: 'Dry',
              quantity: 5,
              notes: 'Top shelf',
              zone: 'South',
              sourceSheet: null,
              sourceRows: [1],
              sourceFile: null,
              sortOrder: 1,
              createdAt: '2026-05-27T08:00:00.000Z'
            }
          ]
        };
      }
      return [];
    });

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('order-items-section')).toBeTruthy());
    expect(screen.getByText('Dry')).toBeTruthy();
    expect(screen.getByText('Top shelf')).toBeTruthy();
    expect(screen.getByText('South')).toBeTruthy();
  });

  it('renders order detail fields', () => {
    renderDetail();
    expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('קו צפון').length).toBeGreaterThan(0);
    expect(screen.getAllByText('לקוח א').length).toBeGreaterThan(0);
  });

  it('renders status badge', () => {
    renderDetail();
    const statuses = screen.getAllByText('בליקוט');
    expect(statuses.some((el) => el.className.includes('rounded-full'))).toBe(true);
  });

  it('renders section headings', () => {
    renderDetail();
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
    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DesktopOrderDetail detail={null} onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/הזמנה/)).toBeTruthy();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DesktopOrderDetail detail={null} onClose={onClose} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /סגור/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
