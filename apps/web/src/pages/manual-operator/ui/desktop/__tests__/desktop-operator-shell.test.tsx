import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('../../shift-open-ashlamot-board', () => ({
  ShiftOpenAshlamotBoard: () => null
}));

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { DesktopOperatorShell } from '../desktop-operator-shell';
import type { DesktopOperatorShellProps } from '../desktop-operator-shell';
import {
  emptyCheckQueue,
  mockActiveOrders,
  mockCheckQueue,
  mockKpi,
  mockLineDetail,
  mockLines,
  mockOrderDetail,
  mockPickerDetail,
  mockPickers,
  mockShift
} from './fixtures';

const mockedBffRequest = vi.mocked(bffRequest);

const defaultProps = {
  shift: mockShift,
  isLoading: false,
  kpi: mockKpi,
  lineSummaries: mockLines,
  activeOrders: mockActiveOrders,
  pickerWorkloads: mockPickers,
  checkQueue: emptyCheckQueue,
  lineDetail: null,
  pickerDetail: null,
  orderDetail: null,
  selectedDetailType: null as 'line' | 'picker' | 'order' | null,
  onSelectLine: vi.fn(),
  onSelectPicker: vi.fn(),
  onSelectOrder: vi.fn(),
  onCloseDetail: vi.fn(),
  onCreateShift: vi.fn(),
  isCreatingShift: false,
  selectedDate: '2026-05-28',
  todayDate: '2026-05-29',
  onChangeDate: vi.fn(),
  onOpenDatePicker: vi.fn(),
  canInteract: true
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function renderShell(props: Partial<DesktopOperatorShellProps> = {}) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DesktopOperatorShell {...defaultProps} {...props} />
    </QueryClientProvider>
  );
}

mockedBffRequest.mockImplementation(async (url, init) => {
  const path = String(url);
  if (path.endsWith(`/manual-shift-orders/${mockOrderDetail.orderId}`) && (init?.method ?? 'GET') === 'GET') {
    return {
      ...mockOrderDetail,
      lineCount: 5,
      totalQuantity: 0,
      items: []
    };
  }
  return [];
});

describe('DesktopOperatorShell', () => {
  it('renders loading skeleton when isLoading is true', () => {
    renderShell({ isLoading: true });
    expect(screen.getByLabelText('טוען נתונים')).toBeTruthy();
  });

  it('renders empty state when shift is null', () => {
    renderShell({ shift: null, isLoading: false });
    expect(screen.getAllByText('אין משמרת פעילה').length).toBeGreaterThan(0);
    expect(screen.getByText('פתח משמרת כדי להתחיל לעקוב אחר ההזמנות')).toBeTruthy();
  });

  it('passes check queue data to picker panel', () => {
    renderShell({ checkQueue: mockCheckQueue });
    expect(screen.getByText(/ממתינים לבדיקה/)).toBeTruthy();
  });

  it('renders line detail drawer when line detail is selected', () => {
    renderShell({ selectedDetailType: 'line', lineDetail: mockLineDetail });
    expect(screen.getByRole('button', { name: /סגור/i })).toBeTruthy();
  });

  it('renders picker detail drawer when picker detail is selected', () => {
    renderShell({ selectedDetailType: 'picker', pickerDetail: mockPickerDetail });
    expect(screen.getByRole('button', { name: /סגור/i })).toBeTruthy();
  });

  it('renders order detail drawer when order detail is selected', () => {
    renderShell({ selectedDetailType: 'order', orderDetail: mockOrderDetail });
    expect(screen.getByTestId('order-detail-view')).toBeTruthy();
  });

  it('calls onCloseDetail when close button is clicked', () => {
    const onCloseDetail = vi.fn();
    renderShell({
      onCloseDetail,
      selectedDetailType: 'line',
      lineDetail: mockLineDetail
    });

    fireEvent.click(screen.getByRole('button', { name: /סגור/i }));
    expect(onCloseDetail).toHaveBeenCalledOnce();
  });

  it('clicking active order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    renderShell({ onSelectOrder });
    fireEvent.click(screen.getByTestId(`active-order-row-${mockActiveOrders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockActiveOrders[0].orderId);
  });

  it('clicking line detail order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    renderShell({
      selectedDetailType: 'line',
      lineDetail: mockLineDetail,
      onSelectOrder
    });
    fireEvent.click(screen.getByTestId(`detail-order-row-${mockLineDetail.orders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockLineDetail.orders[0].orderId);
  });

  it('clicking picker detail order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    renderShell({
      selectedDetailType: 'picker',
      pickerDetail: mockPickerDetail,
      onSelectOrder
    });
    fireEvent.click(screen.getByTestId(`detail-order-row-${mockPickerDetail.orders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockPickerDetail.orders[0].orderId);
  });

  it('date navigation buttons call onChangeDate', () => {
    const onChangeDate = vi.fn();
    renderShell({ onChangeDate });
    fireEvent.click(screen.getByRole('button', { name: 'תאריך קודם' }));
    fireEvent.click(screen.getByRole('button', { name: 'תאריך הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'היום' }));
    expect(onChangeDate).toHaveBeenCalledWith('2026-05-27');
    expect(onChangeDate).toHaveBeenCalledWith('2026-05-29');
    expect(onChangeDate).toHaveBeenCalledTimes(3);
  });

  it('clicking date label calls onOpenDatePicker', () => {
    const onOpenDatePicker = vi.fn();
    renderShell({ onOpenDatePicker });
    fireEvent.click(screen.getByRole('button', { name: 'פתח לוח שנה' }));
    expect(onOpenDatePicker).toHaveBeenCalledOnce();
  });

  it('board wrapper div appears in the aside before DesktopPickerPanel', () => {
    const { container } = renderShell();
    const boardWrapper = container.querySelector('.p-3.border-b');
    const pickerHeader = screen.getByText('מלקטים');
    expect(boardWrapper).toBeTruthy();
    expect(boardWrapper!.compareDocumentPosition(pickerHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
