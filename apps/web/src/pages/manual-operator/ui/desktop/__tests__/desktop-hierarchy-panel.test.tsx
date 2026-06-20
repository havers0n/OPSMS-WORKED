import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { NO_DISTRIBUTION_AREA_KEY } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopHierarchyPanel } from '../desktop-hierarchy-panel';

const mockAreaSummaries: AreaHierarchySummary[] = [
  {
    areaKey: 'צפון',
    displayName: 'צפון',
    areaName: 'צפון',
    totalLines: 2,
    totalBuckets: 3,
    totalOrders: 8,
    totalQuantity: 120,
    statusBreakdown: { queued: 3, picking: 2, waitingCheck: 1, returned: 1, done: 1 }
  },
  {
    areaKey: 'דרום',
    displayName: 'דרום',
    areaName: 'דרום',
    totalLines: 1,
    totalBuckets: 1,
    totalOrders: 3,
    totalQuantity: 20,
    statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];

const mockAreaSummariesWithNullArea: AreaHierarchySummary[] = [
  {
    areaKey: 'צפון',
    displayName: 'צפון',
    areaName: 'צפון',
    totalLines: 1,
    totalBuckets: 1,
    totalOrders: 5,
    totalQuantity: 50,
    statusBreakdown: { queued: 2, picking: 2, waitingCheck: 1, returned: 0, done: 0 }
  },
  {
    areaKey: NO_DISTRIBUTION_AREA_KEY,
    displayName: 'ללא איזור',
    areaName: null,
    totalLines: 1,
    totalBuckets: 1,
    totalOrders: 2,
    totalQuantity: 10,
    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];

const mockLineHierarchySummaries: LineHierarchySummary[] = [
  {
    lineId: 'line-1',
    lineName: 'Line South',
    distributionArea: 'צפון',
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
        pointName: 'Point A',
        status: 'picking',
        workBucketName: 'Point A',
        pickerName: 'David',
        checkerName: null,
        lineCount: 0,
        totalQuantity: 20
      },
      {
        orderId: 'order-2',
        orderNumber: null,
        customerName: null,
        pointName: null,
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
        pointName: null,
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
        selectedAreaKey={null}
        selectedLineId={null}
        selectedRouteGroupKey={null}
        selectedWorkBucketName={null}
        areaSummaries={mockAreaSummaries}
        lineHierarchySummaries={[]}
        areaLineSummaries={mockLineHierarchySummaries}
        workBucketSummaries={[]}
        routeGroupSummaries={[]}
        routeGroupWorkBucketSummaries={[]}
        hasRouteGroups={false}
        showProductRollupDeferred={false}
        onSelectArea={noop}
        onSelectLine={noop}
        onSelectRouteGroup={noop}
        onSelectBucket={noop}
        onSelectOrder={noop}
        onClearArea={noop}
        onClearLine={noop}
        onClearRouteGroup={noop}
        onClearBucket={noop}
        workBucketView="products"
        productRollup={undefined}
        productRollupLoading={false}
        onSetWorkBucketView={noop}
        {...overrides}
      />
    );
  }

  describe('area level (root)', () => {
    it('shows area cards and title "אזורי הפצה"', () => {
      renderPanel();
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByTestId('area-card-צפון')).toBeTruthy();
      expect(screen.getByTestId('area-card-דרום')).toBeTruthy();
    });

    it('shows empty state when no areas exist', () => {
      renderPanel({ areaSummaries: [] });
      expect(screen.getByText('אין אזורים פעילים')).toBeTruthy();
    });

    it('calls onSelectArea when an area card is clicked', () => {
      const onSelectArea = vi.fn();
      renderPanel({ onSelectArea });
      fireEvent.click(screen.getByTestId('area-card-צפון'));
      expect(onSelectArea).toHaveBeenCalledWith('צפון');
    });

    it('renders area metrics', () => {
      renderPanel();
      expect(screen.getByText('2 קווים')).toBeTruthy();
      expect(screen.getByText('3 קבוצות')).toBeTruthy();
      expect(screen.getByText('8 הזמנות')).toBeTruthy();
      expect(screen.getByText('120 יח\'')).toBeTruthy();
    });

    it('renders status breakdown on area cards', () => {
      renderPanel();
      const queuedItems = screen.getAllByText('3 בתור');
      expect(queuedItems.length).toBe(2);
      expect(screen.getByText('2 בליקוט')).toBeTruthy();
      expect(screen.getByText('1 בדיקה')).toBeTruthy();
      expect(screen.getByText('1 הוחזר')).toBeTruthy();
      expect(screen.getByText('1 הושלם')).toBeTruthy();
    });
  });

  describe('null area (ללא איזור)', () => {
    it('renders null-area card with displayName "ללא איזור"', () => {
      renderPanel({ areaSummaries: mockAreaSummariesWithNullArea });
      expect(screen.getByText('ללא איזור')).toBeTruthy();
      expect(screen.getByTestId(`area-card-${NO_DISTRIBUTION_AREA_KEY}`)).toBeTruthy();
    });

    it('selecting null-area does not return to root', () => {
      const onSelectArea = vi.fn();
      renderPanel({ areaSummaries: mockAreaSummariesWithNullArea, onSelectArea });
      fireEvent.click(screen.getByTestId(`area-card-${NO_DISTRIBUTION_AREA_KEY}`));
      expect(onSelectArea).toHaveBeenCalledWith(NO_DISTRIBUTION_AREA_KEY);
    });

    it('shows lines when null-area is selected', () => {
      renderPanel({
        selectedAreaKey: NO_DISTRIBUTION_AREA_KEY,
        areaSummaries: mockAreaSummariesWithNullArea,
        lineHierarchySummaries: [mockLineHierarchySummaries[1]],
        areaLineSummaries: [mockLineHierarchySummaries[1]]
      });
      expect(screen.getByText('קווים')).toBeTruthy();
      expect(screen.getByText('ללא איזור')).toBeTruthy();
    });
  });

  describe('line level (area selected)', () => {
    it('shows lines and title "קווים" after selecting area', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries,
        areaLineSummaries: [mockLineHierarchySummaries[0]]
      });
      expect(screen.getByText('קווים')).toBeTruthy();
      expect(screen.getByTestId('line-summary-card-line-1')).toBeTruthy();
      expect(screen.queryByTestId('line-summary-card-line-2')).toBeNull();
    });

    it('shows breadcrumb "אזורי הפצה > צפון"', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries
      });
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByText('צפון')).toBeTruthy();
    });

    it('calls onClearArea when clicking area breadcrumb', () => {
      const onClearArea = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries,
        onClearArea
      });
      fireEvent.click(screen.getByText('אזורי הפצה'));
      expect(onClearArea).toHaveBeenCalled();
    });

    it('calls onSelectLine when a line card is clicked', () => {
      const onSelectLine = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries,
        onSelectLine
      });
      fireEvent.click(screen.getByTestId('line-summary-card-line-1'));
      expect(onSelectLine).toHaveBeenCalledWith('line-1');
    });

    it('shows empty state when no lines exist in selected area', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: [],
        areaLineSummaries: []
      });
      expect(screen.getByText('אין קווים באזור זה')).toBeTruthy();
    });

    it('renders distribution area on line cards when present', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries
      });
      expect(screen.getByText('אזור הפצה: צפון')).toBeTruthy();
    });
  });

  describe('bucket level (line selected)', () => {
    it('shows work bucket cards when a line is selected', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('Point A')).toBeTruthy();
      expect(screen.getByText('No Point')).toBeTruthy();
    });

    it('shows full breadcrumb "אזורי הפצה > צפון > קו: Line South"', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByText('צפון')).toBeTruthy();
      expect(screen.getByText('קו: Line South')).toBeTruthy();
    });

    it('shows empty state when no work buckets exist in the selected line', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: []
      });
      expect(screen.getByText('אין קבוצות עבודה בקו זה')).toBeTruthy();
    });

    it('calls onSelectBucket when a bucket card is clicked', () => {
      const onSelectBucket = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        onSelectBucket
      });
      fireEvent.click(screen.getByText('Point A'));
      expect(onSelectBucket).toHaveBeenCalledWith('Point A');
    });
  });

  describe('auto-skipped single-line area', () => {
    it('shows work bucket cards without line cards when area has exactly one line', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('Point A')).toBeTruthy();
      expect(screen.getByText('No Point')).toBeTruthy();
      expect(screen.queryByText('קווים')).toBeNull();
      expect(screen.queryByText('קו: Line South')).toBeNull();
    });

    it('shows title "קבוצות עבודה" for auto-skipped area', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('קבוצות עבודה')).toBeTruthy();
    });

    it('shows route context and simplified breadcrumb without line segment for single-line area', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByText('צפון')).toBeTruthy();
      expect(screen.getByText('קו הפצה: Line South')).toBeTruthy();
      expect(screen.queryByText(/קו: /)).toBeNull();
    });

    it('general bucket displays as "כללי" in auto-skipped single-line area', () => {
      const workBucketSummaries: WorkBucketSummary[] = [
        {
          workBucketName: 'Line South',
          ordersCount: 1,
          itemLinesCount: 3,
          totalQuantity: 15,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-99',
              orderNumber: 'SO-100',
              customerName: null,
              pointName: null,
              status: 'queued',
              workBucketName: 'Line South',
              pickerName: null,
              checkerName: null,
              lineCount: 3,
              totalQuantity: 15
            }
          ]
        }
      ];

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries
      });

      expect(screen.getByText('כללי')).toBeTruthy();
    });

    it('suffix buckets still display unchanged in auto-skipped single-line area', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });

      expect(screen.getByText('Point A')).toBeTruthy();
      expect(screen.getByText('No Point')).toBeTruthy();
    });

    it('clicking general bucket passes raw bucket identity, not display label', () => {
      const onSelectBucket = vi.fn();
      const workBucketSummaries: WorkBucketSummary[] = [
        {
          workBucketName: 'Line South',
          ordersCount: 1,
          itemLinesCount: 3,
          totalQuantity: 15,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-99',
              orderNumber: 'SO-100',
              customerName: null,
              pointName: null,
              status: 'queued',
              workBucketName: 'Line South',
              pickerName: null,
              checkerName: null,
              lineCount: 3,
              totalQuantity: 15
            }
          ]
        }
      ];

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries,
        onSelectBucket
      });

      fireEvent.click(screen.getByText('כללי'));
      expect(onSelectBucket).toHaveBeenCalledWith('Line South');
      expect(onSelectBucket).not.toHaveBeenCalledWith('כללי');
    });

    it('clicking "אזורי הפצה" in auto-skip breadcrumb calls onClearArea', () => {
      const onClearArea = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        onClearArea
      });
      fireEvent.click(screen.getByText('אזורי הפצה'));
      expect(onClearArea).toHaveBeenCalled();
    });

    it('auto-skipped area with bucket selected shows simplified breadcrumb and area click calls onClearBucket', () => {
      const onClearBucket = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        areaLineSummaries: [mockLineHierarchySummaries[0]],
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        onClearBucket
      });
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByText('צפון')).toBeTruthy();
      expect(screen.getByText('קבוצת עבודה: Point A')).toBeTruthy();
      expect(screen.queryByText(/קו:/)).toBeNull();
      fireEvent.click(screen.getByText('צפון'));
      expect(onClearBucket).toHaveBeenCalled();
    });
  });

  describe('order level (bucket selected)', () => {
    it('shows order cards for the selected work bucket', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        workBucketView: 'orders'
      });
      expect(screen.getByTestId('order-mini-card-order-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-order-2')).toBeTruthy();
    });

    it('shows full breadcrumb with bucket name', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        workBucketView: 'orders'
      });
      expect(screen.getByText('אזורי הפצה')).toBeTruthy();
      expect(screen.getByText('צפון')).toBeTruthy();
      expect(screen.getByText('קו: Line South')).toBeTruthy();
      expect(screen.getByText('קבוצת עבודה: Point A')).toBeTruthy();
    });

    it('renders customer name when present and stays safe when absent', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        workBucketView: 'orders'
      });
      expect(screen.getByText('Customer A')).toBeTruthy();
      expect(screen.queryByText('null')).toBeNull();
      expect(screen.queryByText('undefined')).toBeNull();
    });

    it('calls onSelectOrder when an order card is clicked', () => {
      const onSelectOrder = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries,
        onSelectOrder,
        workBucketView: 'orders'
      });
      fireEvent.click(screen.getByTestId('order-mini-card-order-1'));
      expect(onSelectOrder).toHaveBeenCalledWith('order-1');
    });

    it('shows empty state when no orders exist in bucket', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Empty Bucket',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: [{
          workBucketName: 'Empty Bucket',
          ordersCount: 0,
          itemLinesCount: 0,
          totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: []
        }],
        workBucketView: 'orders'
      });
      expect(screen.getByText('אין הזמנות בקבוצת עבודה זו')).toBeTruthy();
    });
  });

  describe('clear area returns to root', () => {
    it('onClearArea resets to area list', () => {
      const onClearArea = vi.fn();
      renderPanel({
        selectedAreaKey: 'צפון',
        lineHierarchySummaries: mockLineHierarchySummaries,
        onClearArea
      });
      fireEvent.click(screen.getByText('אזורי הפצה'));
      expect(onClearArea).toHaveBeenCalled();
    });
  });

  describe('bucket label polish', () => {
    it('displays general bucket label when work bucket name equals line name', () => {
      const workBucketSummaries: WorkBucketSummary[] = [
        {
          workBucketName: 'Line South',
          ordersCount: 1,
          itemLinesCount: 3,
          totalQuantity: 15,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-99',
              orderNumber: 'SO-100',
              customerName: null,
              pointName: null,
              status: 'queued',
              workBucketName: 'Line South',
              pickerName: null,
              checkerName: null,
              lineCount: 3,
              totalQuantity: 15
            }
          ]
        }
      ];

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries
      });

      expect(screen.getByText('כללי')).toBeTruthy();
    });

    it('keeps original work bucket name when different from line name', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });

      expect(screen.getByText('Point A')).toBeTruthy();
    });
  });

  describe('null-safe lineCount display', () => {
    it('does not render 0 שורות when lineCount is zero', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        selectedWorkBucketName: 'Point A',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries: mockWorkBucketSummaries
      });

      expect(screen.queryByText('0 שורות')).toBeNull();
    });

    it('renders positive lineCount with שורות label', () => {
      const workBucketSummaries: WorkBucketSummary[] = [
        {
          workBucketName: 'Bucket B',
          ordersCount: 1,
          itemLinesCount: 4,
          totalQuantity: 20,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: [
            {
              orderId: 'order-50',
              orderNumber: 'SO-200',
              customerName: null,
              pointName: null,
              status: 'queued',
              workBucketName: 'Bucket B',
              pickerName: null,
              checkerName: null,
              lineCount: 4,
              totalQuantity: 20
            }
          ]
        }
      ];

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-2',
        selectedWorkBucketName: 'Bucket B',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries,
        workBucketView: 'orders'
      });

      expect(screen.getByText('4 שורות')).toBeTruthy();
    });

    it('does not render 0 פריטים / שורות on work bucket cards', () => {
      const workBucketSummaries: WorkBucketSummary[] = [
        {
          workBucketName: 'Empty Bucket',
          ordersCount: 0,
          itemLinesCount: 0,
          totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          orders: []
        }
      ];

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: mockLineHierarchySummaries,
        workBucketSummaries
      });

      expect(screen.queryByText(/0 פריטים/)).toBeNull();
    });
  });
});
