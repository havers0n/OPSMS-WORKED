import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LineHierarchySummary, WorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopHierarchyPanel } from '../desktop-hierarchy-panel';

const mockLineHierarchySummaries: LineHierarchySummary[] = [
  {
    lineId: 'line-1',
    lineName: 'Line South',
    distributionArea: 'South',
    lineStatus: 'in_progress',
    ordersCount: 5,
    itemLinesCount: 12,
    totalQuantity: 64,
    statusBreakdown: { queued: 2, picking: 1, waitingCheck: 0, returned: 0, done: 1 }
  },
  {
    lineId: 'line-2',
    lineName: 'Line North',
    distributionArea: null,
    lineStatus: 'open',
    ordersCount: 3,
    itemLinesCount: 6,
    totalQuantity: 20,
    statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];

const mockWorkBucketSummaries: WorkBucketSummary[] = [
  {
    workBucketName: 'Point A',
    ordersCount: 2,
    itemLinesCount: 2,
    totalQuantity: 32,
    statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 1, done: 0 },
    orders: [
      {
        orderId: 'order-1',
        orderNumber: 'SO26015545',
        customerName: 'Customer A',
        status: 'picking',
        workBucketName: 'Point A',
        pickerName: 'David',
        checkerName: null,
        lineCount: 0,
        totalQuantity: 20
      },
      {
        orderId: 'order-2',
        orderNumber: 'SO26015546',
        customerName: null,
        status: 'returned',
        workBucketName: 'Point A',
        pickerName: null,
        checkerName: null,
        lineCount: 0,
        totalQuantity: 12
      }
    ]
  },
  {
    workBucketName: 'No Point',
    ordersCount: 1,
    itemLinesCount: 1,
    totalQuantity: 10,
    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    orders: [
      {
        orderId: 'order-3',
        orderNumber: null,
        customerName: null,
        status: 'queued',
        workBucketName: 'No Point',
        pickerName: null,
        checkerName: null,
        lineCount: 0,
        totalQuantity: 10
      }
    ]
  }
];

describe('DesktopHierarchyPanel', () => {
  const noop = vi.fn();

  function renderPanel(overrides: Partial<Parameters<typeof DesktopHierarchyPanel>[0]> = {}) {
    return render(
      <DesktopHierarchyPanel
        selectedLineId={null}
        selectedWorkBucketName={null}
        lineHierarchySummaries={mockLineHierarchySummaries}
        workBucketSummaries={[]}
        onSelectLine={noop}
        onSelectBucket={noop}
        onSelectOrder={noop}
        onClearLine={noop}
        onClearBucket={noop}
        {...overrides}
      />
    );
  }

  it('shows line summary cards in the default state', () => {
    renderPanel();
    expect(screen.getByTestId('line-summary-card-line-1')).toBeTruthy();
    expect(screen.getByTestId('line-summary-card-line-2')).toBeTruthy();
  });

  it('renders distribution area on line cards when present', () => {
    renderPanel();
    expect(screen.getByText('אזור הפצה: South')).toBeTruthy();
  });

  it('calls onSelectLine when a line card is clicked', () => {
    const onSelectLine = vi.fn();
    renderPanel({ onSelectLine });
    fireEvent.click(screen.getByTestId('line-summary-card-line-1'));
    expect(onSelectLine).toHaveBeenCalledWith('line-1');
  });

  it('shows work bucket cards when a line is selected', () => {
    renderPanel({
      selectedLineId: 'line-1',
      workBucketSummaries: mockWorkBucketSummaries
    });
    expect(screen.getByText('Point A')).toBeTruthy();
    expect(screen.getByText('No Point')).toBeTruthy();
  });

  it('shows empty state when no work buckets exist in the selected line', () => {
    renderPanel({
      selectedLineId: 'line-1',
      workBucketSummaries: []
    });
    expect(screen.getByText('אין קבוצות עבודה בקו זה')).toBeTruthy();
  });

  it('shows order cards for the selected work bucket', () => {
    renderPanel({
      selectedLineId: 'line-1',
      selectedWorkBucketName: 'Point A',
      workBucketSummaries: mockWorkBucketSummaries
    });
    expect(screen.getByTestId('order-mini-card-order-1')).toBeTruthy();
    expect(screen.getByTestId('order-mini-card-order-2')).toBeTruthy();
  });

  it('renders customer name when present and stays safe when absent', () => {
    renderPanel({
      selectedLineId: 'line-1',
      selectedWorkBucketName: 'Point A',
      workBucketSummaries: mockWorkBucketSummaries
    });
    expect(screen.getByText('Customer A')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('undefined')).toBeNull();
  });

  it('calls onSelectOrder when an order card is clicked', () => {
    const onSelectOrder = vi.fn();
    renderPanel({
      selectedLineId: 'line-1',
      selectedWorkBucketName: 'Point A',
      workBucketSummaries: mockWorkBucketSummaries,
      onSelectOrder
    });
    fireEvent.click(screen.getByTestId('order-mini-card-order-1'));
    expect(onSelectOrder).toHaveBeenCalledWith('order-1');
  });

  describe('bucket label polish', () => {
    it('displays general bucket label when point name equals line name', () => {
      const pointSummaries: PointHierarchySummary[] = [
        {
          pointName: 'Line South',
          ordersCount: 1,
          itemLinesCount: 3,
          totalQuantity: 15,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-99',
              orderNumber: 'SO-100',
              customerName: null,
              status: 'queued',
              pointName: 'Line South',
              pickerName: null,
              checkerName: null,
              lineCount: 3,
              totalQuantity: 15
            }
          ]
        }
      ];

      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries
      });

      expect(screen.getByText('Line South — כללי')).toBeTruthy();
    });

    it('keeps original point name when different from line name', () => {
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: mockPointSummaries
      });

      expect(screen.getByText('Point A')).toBeTruthy();
    });
  });

  describe('null-safe lineCount display', () => {
    it('does not render 0 שורות when lineCount is zero', () => {
      renderPanel({
        selectedLineId: 'line-1',
        selectedPointName: 'Point A',
        pointSummaries: mockPointSummaries
      });

      expect(screen.queryByText('0 שורות')).toBeNull();
    });

    it('renders positive lineCount with שורות label', () => {
      const pointSummaries: PointHierarchySummary[] = [
        {
          pointName: 'Point B',
          ordersCount: 1,
          itemLinesCount: 4,
          totalQuantity: 20,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-50',
              orderNumber: 'SO-200',
              customerName: null,
              status: 'queued',
              pointName: 'Point B',
              pickerName: null,
              checkerName: null,
              lineCount: 4,
              totalQuantity: 20
            }
          ]
        }
      ];

      renderPanel({
        selectedLineId: 'line-2',
        selectedPointName: 'Point B',
        pointSummaries
      });

      expect(screen.getByText('4 שורות')).toBeTruthy();
    });

    it('does not render 0 פריטים / שורות on point cards', () => {
      const pointSummaries: PointHierarchySummary[] = [
        {
          pointName: 'Empty Point',
          ordersCount: 0,
          itemLinesCount: 0,
          totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: []
        }
      ];

      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries
      });

      expect(screen.queryByText(/0 פריטים/)).toBeNull();
    });
  });
});
