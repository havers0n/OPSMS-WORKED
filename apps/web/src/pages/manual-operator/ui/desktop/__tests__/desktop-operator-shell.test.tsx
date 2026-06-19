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
  mockCheckQueue,
  mockKpi,
  mockOrderDetail,
  mockPickerDetail,
  mockPickers,
  mockShift,
  mockLineHierarchySummaries,
  mockWorkBucketSummaries,
  mockAreaSummaries
} from './fixtures';

const mockedBffRequest = vi.mocked(bffRequest);

const defaultProps = {
  shift: mockShift,
  isLoading: false,
  kpi: mockKpi,
  pickerWorkloads: mockPickers,
  checkQueue: emptyCheckQueue,
  pickerDetail: null,
  orderDetail: null,
  selectedDetailType: null as 'picker' | 'order' | null,
  selectedAreaKey: null as string | null,
  selectedLineId: null as string | null,
  selectedWorkBucketName: null as string | null,
  areaSummaries: mockAreaSummaries,
  lineHierarchySummaries: mockLineHierarchySummaries,
  areaLineSummaries: mockLineHierarchySummaries,
  workBucketSummaries: mockWorkBucketSummaries,
  onSelectPicker: vi.fn(),
  onSelectOrder: vi.fn(),
  onCloseDetail: vi.fn(),
  onSelectArea: vi.fn(),
  onSelectHierarchyLine: vi.fn(),
  onSelectHierarchyBucket: vi.fn(),
  onClearArea: vi.fn(),
  onClearHierarchyLine: vi.fn(),
  onClearHierarchyBucket: vi.fn(),
  workBucketView: 'products' as const,
  productRollup: undefined,
  productRollupLoading: false,
  onSetWorkBucketView: vi.fn(),
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
      selectedDetailType: 'picker',
      pickerDetail: mockPickerDetail
    });

    fireEvent.click(screen.getByRole('button', { name: /סגור/i }));
    expect(onCloseDetail).toHaveBeenCalledOnce();
  });

  it('clicking line summary card calls onSelectHierarchyLine', () => {
    const onSelectHierarchyLine = vi.fn();
    renderShell({ onSelectHierarchyLine, selectedAreaKey: 'צפון' });
    fireEvent.click(screen.getByTestId('line-summary-card-line-1'));
    expect(onSelectHierarchyLine).toHaveBeenCalledWith('line-1');
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

  it('right sidebar with pickers is visible when no detail drawer is open', () => {
    const { container } = renderShell();
    const asideElements = container.querySelectorAll('aside');
    const pickerAside = Array.from(asideElements).find((a) => a.textContent?.includes('מלקטים'));
    expect(pickerAside).toBeTruthy();
  });

  it('right sidebar with pickers is hidden when order detail drawer is open', () => {
    const { container } = renderShell({ selectedDetailType: 'order', orderDetail: mockOrderDetail });
    const asideElements = container.querySelectorAll('aside');
    const pickerAside = Array.from(asideElements).find((a) => a.textContent?.includes('מלקטים'));
    expect(pickerAside).toBeUndefined();
  });

  it('right sidebar with pickers is hidden when picker detail drawer is open', () => {
    const { container } = renderShell({ selectedDetailType: 'picker', pickerDetail: mockPickerDetail });
    const asideElements = container.querySelectorAll('aside');
    const pickerAside = Array.from(asideElements).find((a) => a.textContent?.includes('מלקטים'));
    expect(pickerAside).toBeUndefined();
  });

  it('board wrapper div appears in the aside before DesktopPickerPanel', () => {
    const { container } = renderShell();
    const boardWrapper = container.querySelector('.p-3.border-b');
    const pickerHeader = screen.getByText('מלקטים');
    expect(boardWrapper).toBeTruthy();
    expect(boardWrapper!.compareDocumentPosition(pickerHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
