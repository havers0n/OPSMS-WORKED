import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { DesktopOperatorShell } from '../desktop-operator-shell';
import type { DesktopOperatorShellProps } from '../desktop-operator-shell';
import {
  mockKpi,
  mockOrderDetail,
  mockShift,
  mockLineHierarchySummaries,
  mockWorkGroupSummaries,
  mockAreaSummaries
} from './fixtures';

const mockedBffRequest = vi.mocked(bffRequest);

const defaultProps: DesktopOperatorShellProps = {
  shift: mockShift,
  isLoading: false,
  kpi: mockKpi,
  orderDetail: null,
  selectedDetailType: null,
  selectedAreaKey: null,
  selectedLineId: null,
  selectedDistributionGroupKey: null,
  selectedWorkGroupKey: null,
  selectedDistributionGroupWorkGroup: undefined,
  selectedWorkBucketName: null,
  areaSummaries: mockAreaSummaries,
  specialAreaSummaries: [],
  lineHierarchySummaries: mockLineHierarchySummaries,
  areaLineSummaries: mockLineHierarchySummaries,
  workGroupSummaries: mockWorkGroupSummaries,
  distributionGroupSummaries: [],
  distributionGroupWorkGroupSummaries: [],
  hasDistributionGroups: false,
  showProductRollupDeferred: false,
  onSelectOrder: vi.fn(),
  onCloseDetail: vi.fn(),
  onSelectArea: vi.fn(),
  onSelectHierarchyLine: vi.fn(),
  onSelectHierarchyDistributionGroup: vi.fn(),
  onSelectHierarchyBucket: vi.fn(),
  onClearArea: vi.fn(),
  onClearHierarchyLine: vi.fn(),
  onClearHierarchyDistributionGroup: vi.fn(),
  onClearHierarchyBucket: vi.fn(),
  workBucketView: 'products',
  productRollup: undefined,
  productRollupLoading: false,
  onSetWorkBucketView: vi.fn(),
  onCreateShift: vi.fn(),
  isCreatingShift: false
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

  it('renders hierarchy panel area cards and line summaries', () => {
    renderShell();
    expect(screen.getByTestId('area-card-צפון')).toBeTruthy();
    expect(screen.getByTestId('area-card-דרום')).toBeTruthy();
  });

  it('renders hierarchy line summary cards when an area is selected', () => {
    renderShell({ selectedAreaKey: 'צפון' });
    expect(screen.getByTestId('line-summary-card-line-1')).toBeTruthy();
  });

  it('clicking line summary card calls onSelectHierarchyLine', () => {
    const onSelectHierarchyLine = vi.fn();
    renderShell({ onSelectHierarchyLine, selectedAreaKey: 'צפון' });
    fireEvent.click(screen.getByTestId('line-summary-card-line-1'));
    expect(onSelectHierarchyLine).toHaveBeenCalledWith('line-1');
  });

  it('renders order detail drawer when order detail is selected', () => {
    renderShell({ selectedDetailType: 'order', orderDetail: mockOrderDetail });
    expect(screen.getByTestId('order-detail-view')).toBeTruthy();
  });

  it('calls onCloseDetail when close button is clicked in order detail drawer', () => {
    const onCloseDetail = vi.fn();
    renderShell({
      onCloseDetail,
      selectedDetailType: 'order',
      orderDetail: mockOrderDetail
    });

    fireEvent.click(screen.getByRole('button', { name: /סגור/i }));
    expect(onCloseDetail).toHaveBeenCalledOnce();
  });

  it('does not render the extracted shared header controls', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: 'תאריך קודם' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'פתח לוח שנה' })).toBeNull();
  });

  it('does not render DesktopPickerPanel side panel', () => {
    renderShell();
    expect(screen.queryByText('מלקטים')).toBeNull();
  });
});
