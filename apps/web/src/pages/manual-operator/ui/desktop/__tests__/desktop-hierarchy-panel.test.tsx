import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  RouteGroupSummary,
  RouteGroupWorkBucketSummary,
  WorkBucketSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { NO_DISTRIBUTION_AREA_KEY } from '@/entities/manual-shift/model/shift-selectors';
import { bffRequestBlob } from '@/shared/api/bff/client';
import { DesktopHierarchyPanel } from '../desktop-hierarchy-panel';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequestBlob: vi.fn()
}));

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
  const pdfBlob = new Blob(['pdf'], { type: 'application/pdf' });

  beforeEach(() => {
    vi.mocked(bffRequestBlob).mockReset();
    vi.mocked(bffRequestBlob).mockResolvedValue({ blob: pdfBlob, filename: 'picker-sheet.pdf' });
    vi.stubGlobal('open', vi.fn(() => ({ location: { href: '' }, close: vi.fn(), opener: window })));
    URL.createObjectURL = vi.fn(() => 'blob:picker-sheet');
    URL.revokeObjectURL = vi.fn();
  });

  function renderPanel(overrides: Partial<Parameters<typeof DesktopHierarchyPanel>[0]> = {}) {
    return render(
      <MemoryRouter>
        <DesktopHierarchyPanel
          selectedAreaKey={null}
          selectedLineId={null}
          selectedRouteGroupKey={null}
          selectedWorkBucketKey={null}
          selectedRouteGroupWorkBucket={undefined}
          selectedWorkBucketName={null}
          areaSummaries={mockAreaSummaries}
          specialAreaSummaries={[]}
          lineHierarchySummaries={[]}
          areaLineSummaries={mockLineHierarchySummaries}
          workBucketSummaries={[]}
          routeGroupSummaries={[]}
          routeGroupWorkBucketSummaries={[]}
          hasRouteGroups={false}
          shiftId={null}
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
      </MemoryRouter>
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

  describe('route group product rollup deferral', () => {
    const mockRouteGroupSummaries: RouteGroupSummary[] = [
      {
        routeGroupKey: 'galil-general',
        routeGroupName: 'גליל כללי',
        classificationConfidence: 'high',
        orderCount: 4,
        itemLinesCount: 10,
        totalQuantity: 100,
        statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        workBucketCount: 2
      }
    ];

    const mockRouteGroupWorkBucketSummaries: RouteGroupWorkBucketSummary[] = [
      {
        workBucketKey: 'wb-klali',
        workBucketName: 'כללי',
        workBucketDisplayName: 'כללי',
        classificationConfidence: 'high',
        orderCount: 3,
        itemLinesCount: 7,
        totalQuantity: 60,
        statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: [
          { orderId: 'o-1', orderNumber: 'SO26013614', customerName: 'לקוח א', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 20 },
          { orderId: 'o-2', orderNumber: 'SO26013629', customerName: 'לקוח ב', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 20 },
          { orderId: 'o-3', orderNumber: 'SO26013663', customerName: 'לקוח ג', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 20 }
        ]
      },
      {
        workBucketKey: 'wb-sellular',
        workBucketName: 'סלולר',
        workBucketDisplayName: 'סלולר',
        classificationConfidence: 'high',
        orderCount: 1,
        itemLinesCount: 3,
        totalQuantity: 40,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: [
          { orderId: 'o-4', orderNumber: 'SO26013678', customerName: 'לקוח ד', pointName: 'סלולר', status: 'queued', workBucketName: 'סלולר', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 40 }
        ]
      }
    ];

    const mockSelectedGalilBucket = mockRouteGroupWorkBucketSummaries[0];
    const _mockSelectedSellularBucket = mockRouteGroupWorkBucketSummaries[1];

    it('does NOT render deferred message when showProductRollupDeferred=false', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-klali',
        selectedRouteGroupWorkBucket: mockSelectedGalilBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [{ areaKey: 'גליל', displayName: 'גליל', areaName: 'גליל', totalLines: 1, totalBuckets: 2, totalOrders: 4, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        areaLineSummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        lineHierarchySummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        hasRouteGroups: true,
        routeGroupSummaries: mockRouteGroupSummaries,
        routeGroupWorkBucketSummaries: mockRouteGroupWorkBucketSummaries,
        showProductRollupDeferred: false,
        workBucketView: 'products',
        productRollup: [{ sku: 'SKU-001', description: 'מוצר לדוגמה', category: 'קטגוריה', totalQuantity: 10, orderCount: 2 }],
        productRollupLoading: false
      });

      // Deferred message should NOT be present
      expect(screen.queryByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeNull();
      // Product table should render
      expect(screen.getByTestId('bucket-product-table')).toBeTruthy();
      // Product row should render
      expect(screen.getByTestId('product-row-SKU-001')).toBeTruthy();
      // Breadcrumb uses קבוצת חלוקה, not נקודה
      expect(screen.getByText('קבוצת חלוקה: גליל כללי')).toBeTruthy();
      // Current work bucket label
      expect(screen.getByText('קבוצת עבודה: כללי')).toBeTruthy();
    });

    it('renders deferred message when showProductRollupDeferred=true', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-klali',
        selectedRouteGroupWorkBucket: mockSelectedGalilBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [{ areaKey: 'גליל', displayName: 'גליל', areaName: 'גליל', totalLines: 1, totalBuckets: 2, totalOrders: 4, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        areaLineSummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        lineHierarchySummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        hasRouteGroups: true,
        routeGroupSummaries: mockRouteGroupSummaries,
        routeGroupWorkBucketSummaries: mockRouteGroupWorkBucketSummaries,
        showProductRollupDeferred: true,
        workBucketView: 'products'
      });

      // Deferred message SHOULD be present
      expect(screen.getByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeTruthy();
      // Product table should NOT render
      expect(screen.queryByTestId('bucket-product-table')).toBeNull();
    });

    it('orders tab only renders the selected bucket orders', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-klali',
        selectedRouteGroupWorkBucket: mockSelectedGalilBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [{ areaKey: 'גליל', displayName: 'גליל', areaName: 'גליל', totalLines: 1, totalBuckets: 2, totalOrders: 4, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        areaLineSummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        lineHierarchySummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 4, itemLinesCount: 10, totalQuantity: 100, statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        hasRouteGroups: true,
        routeGroupSummaries: mockRouteGroupSummaries,
        routeGroupWorkBucketSummaries: mockRouteGroupWorkBucketSummaries,
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-o-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-o-2')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-o-3')).toBeTruthy();
      expect(screen.queryByTestId('order-mini-card-o-4')).toBeNull();
    });

    it('standalone route-group bucket still renders its own orders', () => {
      const standaloneBucket: RouteGroupWorkBucketSummary = {
        workBucketKey: 'wb-dabach',
        workBucketName: 'כללי',
        workBucketDisplayName: 'כללי',
        classificationConfidence: 'high',
        orderCount: 1,
        itemLinesCount: 2,
        totalQuantity: 20,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: [
          { orderId: 'd-1', orderNumber: 'SO26000001', customerName: 'לקוח ז', pointName: 'דבאח עין המפרץ', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 20 }
        ]
      };

      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'dbeach',
        selectedWorkBucketKey: 'wb-dabach',
        selectedRouteGroupWorkBucket: standaloneBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [{ areaKey: 'גליל', displayName: 'גליל', areaName: 'גליל', totalLines: 1, totalBuckets: 1, totalOrders: 1, totalQuantity: 20, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        areaLineSummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 1, itemLinesCount: 2, totalQuantity: 20, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        lineHierarchySummaries: [{ lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל', lineStatus: 'open', ordersCount: 1, itemLinesCount: 2, totalQuantity: 20, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 } }],
        hasRouteGroups: true,
        routeGroupSummaries: [
          { routeGroupKey: 'dbeach', routeGroupName: 'דבאח עין המפרץ', classificationConfidence: 'high', orderCount: 1, itemLinesCount: 2, totalQuantity: 20, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, workBucketCount: 1 }
        ],
        routeGroupWorkBucketSummaries: [standaloneBucket],
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-d-1')).toBeTruthy();
    });
  });

  describe('selectedRouteGroupWorkBucket as single source of truth', () => {
    const mockGalilArea = {
      areaKey: 'גליל', displayName: 'גליל', areaName: 'גליל',
      totalLines: 1, totalBuckets: 2, totalOrders: 4, totalQuantity: 100,
      statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
    };

    const mockGalilLineSummary = {
      lineId: 'line-galil', lineName: 'גליל', distributionArea: 'גליל',
      lineStatus: 'open' as const, ordersCount: 4, itemLinesCount: 10, totalQuantity: 100,
      statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
    };

    const mockGalilRouteGroup: RouteGroupSummary = {
      routeGroupKey: 'galil-general', routeGroupName: 'גליל כללי',
      classificationConfidence: 'high', orderCount: 4, itemLinesCount: 10, totalQuantity: 100,
      statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      workBucketCount: 2
    };

    const mockRouteGroupWBKlali: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-galil-klali', workBucketName: 'כללי', workBucketDisplayName: 'כללי',
      classificationConfidence: 'high', orderCount: 3, itemLinesCount: 7, totalQuantity: 60,
      statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: [
        { orderId: 'g-o-1', orderNumber: 'SO26013614', customerName: 'לקוח א', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 20 },
        { orderId: 'g-o-2', orderNumber: 'SO26013629', customerName: 'לקוח ב', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 20 },
        { orderId: 'g-o-3', orderNumber: 'SO26013663', customerName: 'לקוח ג', pointName: 'גליל', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 20 }
      ]
    };

    const mockRouteGroupWBSellular: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-galil-sellular', workBucketName: 'סלולר', workBucketDisplayName: 'סלולר',
      classificationConfidence: 'high', orderCount: 1, itemLinesCount: 3, totalQuantity: 40,
      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: [
        { orderId: 'g-o-4', orderNumber: 'SO26013678', customerName: 'לקוח ד', pointName: 'סלולר', status: 'queued', workBucketName: 'סלולר', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 40 }
      ]
    };

    const mockDabachRouteGroup: RouteGroupSummary = {
      routeGroupKey: 'dbeach', routeGroupName: 'דבאח עין המפרץ',
      classificationConfidence: 'high', orderCount: 2, itemLinesCount: 5, totalQuantity: 60,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      workBucketCount: 1
    };

    const mockDabachBucket: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-dbeach-klali', workBucketName: 'כללי', workBucketDisplayName: 'כללי',
      classificationConfidence: 'high', orderCount: 2, itemLinesCount: 5, totalQuantity: 60,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: [
        { orderId: 'd-o-1', orderNumber: 'SO26013686', customerName: 'לקוח ה', pointName: 'דבאח עין המפרץ', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 30 },
        { orderId: 'd-o-2', orderNumber: 'SO26013699', customerName: 'לקוח ו', pointName: 'דבאח עין המפרץ', status: 'queued', workBucketName: 'כללי', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 30 }
      ]
    };

    const mockMultiSourceRouteGroup: RouteGroupSummary = {
      routeGroupKey: 'multi-src', routeGroupName: 'מעורב',
      classificationConfidence: 'high', orderCount: 2, itemLinesCount: 5, totalQuantity: 30,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      workBucketCount: 1
    };

    const mockMultiSourceBucket: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-mixed', workBucketName: 'מעורב', workBucketDisplayName: 'מעורב',
      classificationConfidence: 'high', orderCount: 2, itemLinesCount: 5, totalQuantity: 30,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: [
        { orderId: 'm-o-1', orderNumber: 'SO-1', customerName: 'לקוח א', pointName: 'גליל', status: 'queued', workBucketName: 'מעורב', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 10 },
        { orderId: 'm-o-2', orderNumber: 'SO-2', customerName: 'לקוח ב', pointName: 'סלולר', status: 'queued', workBucketName: 'מעורב', pickerName: null, checkerName: null, lineCount: 3, totalQuantity: 20 }
      ]
    };

    function renderRouteGroupPanel(overrides: Partial<Parameters<typeof DesktopHierarchyPanel>[0]> = {}) {
      return renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockGalilRouteGroup],
        routeGroupWorkBucketSummaries: [mockRouteGroupWBKlali, mockRouteGroupWBSellular],
        ...overrides
      });
    }

    // ── Case 1: גליל כללי > כללי ──────────────────────────────────────────
    it('Case 1 — גליל כללי > כללי: product table renders with pointName=גליל', () => {
      renderRouteGroupPanel({
        selectedWorkBucketKey: 'wb-galil-klali',
        selectedRouteGroupWorkBucket: mockRouteGroupWBKlali,
        selectedWorkBucketName: 'כללי',
        showProductRollupDeferred: false,
        workBucketView: 'products',
        productRollup: [{ sku: 'SKU-1', description: 'מוצר', category: 'קטגוריה', totalQuantity: 10, orderCount: 2 }],
        productRollupLoading: false
      });

      expect(screen.queryByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeNull();
      expect(screen.getByTestId('bucket-product-table')).toBeTruthy();
      expect(screen.getByText('קבוצת עבודה: כללי')).toBeTruthy();
    });

    it('Case 1 — גליל כללי > כללי: orders tab contains only orders with pointName=גליל', () => {
      renderRouteGroupPanel({
        selectedWorkBucketKey: 'wb-galil-klali',
        selectedRouteGroupWorkBucket: mockRouteGroupWBKlali,
        selectedWorkBucketName: 'כללי',
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-g-o-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-g-o-2')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-g-o-3')).toBeTruthy();
      expect(screen.queryByTestId('order-mini-card-g-o-4')).toBeNull();
    });

    // ── Case 2: גליל כללי > סלולר ──────────────────────────────────────────
    it('Case 2 — גליל כללי > סלולר: product table renders with pointName=סלולר, not deferred', () => {
      renderRouteGroupPanel({
        selectedWorkBucketKey: 'wb-galil-sellular',
        selectedRouteGroupWorkBucket: mockRouteGroupWBSellular,
        selectedWorkBucketName: 'סלולר',
        showProductRollupDeferred: false,
        workBucketView: 'products',
        productRollup: [{ sku: 'SKU-2', description: 'טלפון', category: 'סלולר', totalQuantity: 5, orderCount: 1 }],
        productRollupLoading: false
      });

      expect(screen.queryByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeNull();
      expect(screen.getByTestId('bucket-product-table')).toBeTruthy();
      expect(screen.getByText('קבוצת עבודה: סלולר')).toBeTruthy();
    });

    it('Case 2 — גליל כללי > סלולר: orders tab contains only orders with pointName=סלולר', () => {
      renderRouteGroupPanel({
        selectedWorkBucketKey: 'wb-galil-sellular',
        selectedRouteGroupWorkBucket: mockRouteGroupWBSellular,
        selectedWorkBucketName: 'סלולר',
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-g-o-4')).toBeTruthy();
      expect(screen.queryByTestId('order-mini-card-g-o-1')).toBeNull();
      expect(screen.queryByTestId('order-mini-card-g-o-2')).toBeNull();
      expect(screen.queryByTestId('order-mini-card-g-o-3')).toBeNull();
    });

    // ── Case 3: גליל כללי > רכב-פז נהריה ──────────────────────────────────
    it('Case 3 — route group category bucket with single pointName renders product table', () => {
      const rechevBucket: RouteGroupWorkBucketSummary = {
        workBucketKey: 'wb-rechev', workBucketName: 'רכב-פז נהריה', workBucketDisplayName: 'רכב-פז נהריה',
        classificationConfidence: 'high', orderCount: 1, itemLinesCount: 2, totalQuantity: 25,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: [
          { orderId: 'r-o-1', orderNumber: 'SO-Rechev', customerName: 'לקוח ז', pointName: 'רכב-פז נהריה', status: 'queued', workBucketName: 'רכב-פז נהריה', pickerName: null, checkerName: null, lineCount: 2, totalQuantity: 25 }
        ]
      };

      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-rechev',
        selectedRouteGroupWorkBucket: rechevBucket,
        selectedWorkBucketName: 'רכב-פז נהריה',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockGalilRouteGroup],
        routeGroupWorkBucketSummaries: [mockRouteGroupWBKlali, mockRouteGroupWBSellular, rechevBucket],
        showProductRollupDeferred: false,
        workBucketView: 'products',
        productRollup: [{ sku: 'SKU-R', description: 'חלקי רכב', category: 'רכב', totalQuantity: 25, orderCount: 1 }],
        productRollupLoading: false
      });

      expect(screen.queryByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeNull();
      expect(screen.getByTestId('bucket-product-table')).toBeTruthy();
    });

    // ── Case 4: דבאח עין המפרץ > כללי ──────────────────────────────────────
    it('Case 4 — standalone route group bucket uses pointName from orders, not semantic כללי', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'dbeach',
        selectedWorkBucketKey: 'wb-dbeach-klali',
        selectedRouteGroupWorkBucket: mockDabachBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockDabachRouteGroup],
        routeGroupWorkBucketSummaries: [mockDabachBucket],
        showProductRollupDeferred: false,
        workBucketView: 'products',
        productRollup: [{ sku: 'SKU-D', description: 'דבאח', category: 'דבאח', totalQuantity: 60, orderCount: 2 }],
        productRollupLoading: false
      });

      expect(screen.queryByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeNull();
      expect(screen.getByTestId('bucket-product-table')).toBeTruthy();
      // Breadcrumb shows the routeGroupName, not semantic label
      expect(screen.getByText('קבוצת חלוקה: דבאח עין המפרץ')).toBeTruthy();
    });

    it('Case 4 — standalone route group orders tab uses selectedRouteGroupWorkBucket.orders', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'dbeach',
        selectedWorkBucketKey: 'wb-dbeach-klali',
        selectedRouteGroupWorkBucket: mockDabachBucket,
        selectedWorkBucketName: 'כללי',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockDabachRouteGroup],
        routeGroupWorkBucketSummaries: [mockDabachBucket],
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-d-o-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-d-o-2')).toBeTruthy();
    });

    // ── Case 7: Intentional multi-source → deferred ────────────────────────
    it('Case 7 — multi-source work bucket renders deferred placeholder', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'multi-src',
        selectedWorkBucketKey: 'wb-mixed',
        selectedRouteGroupWorkBucket: mockMultiSourceBucket,
        selectedWorkBucketName: 'מעורב',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockMultiSourceRouteGroup],
        routeGroupWorkBucketSummaries: [mockMultiSourceBucket],
        showProductRollupDeferred: true,
        workBucketView: 'products'
      });

      expect(screen.getByText('תצוגת מוצרים לקבוצת חלוקה מרובת מקורות תתווסף בשלב הבא')).toBeTruthy();
      expect(screen.queryByTestId('bucket-product-table')).toBeNull();
    });

    it('Case 7 — multi-source work bucket orders tab still shows both orders', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'multi-src',
        selectedWorkBucketKey: 'wb-mixed',
        selectedRouteGroupWorkBucket: mockMultiSourceBucket,
        selectedWorkBucketName: 'מעורב',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockMultiSourceRouteGroup],
        routeGroupWorkBucketSummaries: [mockMultiSourceBucket],
        showProductRollupDeferred: true,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-m-o-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-m-o-2')).toBeTruthy();
    });

    // ── Case 6: No sibling bucket leakage ───────────────────────────────────
    it('selected bucket orders do not include sibling bucket orders', () => {
      renderRouteGroupPanel({
        selectedWorkBucketKey: 'wb-galil-klali',
        selectedRouteGroupWorkBucket: mockRouteGroupWBKlali,
        selectedWorkBucketName: 'כללי',
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      expect(screen.getByTestId('order-mini-card-g-o-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-g-o-2')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-g-o-3')).toBeTruthy();
      // Sibling bucket order 'g-o-4' (סלולר) must NOT appear
      expect(screen.queryByTestId('order-mini-card-g-o-4')).toBeNull();
    });

    // ── Zero orders edge case ───────────────────────────────────────────────
    it('work bucket with zero orders renders empty state', () => {
      const emptyBucket: RouteGroupWorkBucketSummary = {
        workBucketKey: 'wb-empty', workBucketName: 'ריק', workBucketDisplayName: 'ריק',
        classificationConfidence: 'high', orderCount: 0, itemLinesCount: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-empty',
        selectedRouteGroupWorkBucket: emptyBucket,
        selectedWorkBucketName: 'ריק',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockGalilRouteGroup],
        routeGroupWorkBucketSummaries: [emptyBucket],
        showProductRollupDeferred: true,
        workBucketView: 'orders'
      });

      expect(screen.getByText('אין הזמנות בקבוצת עבודה זו')).toBeTruthy();
    });

    // ── selectedRouteGroupWorkBucket is sole source for orders ──────────────
    it('orders tab uses selectedRouteGroupWorkBucket.orders, ignoring routeGroupWorkBucketSummaries list', () => {
      // Provide a bucket via selectedRouteGroupWorkBucket that is NOT in routeGroupWorkBucketSummaries
      const standaloneBucket: RouteGroupWorkBucketSummary = {
        workBucketKey: 'wb-standalone', workBucketName: 'עצמאי', workBucketDisplayName: 'עצמאי',
        classificationConfidence: 'high', orderCount: 1, itemLinesCount: 1, totalQuantity: 10,
        statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: [
          { orderId: 's-o-1', orderNumber: 'SO-9', customerName: 'בודד', pointName: 'עצמאי', status: 'queued', workBucketName: 'עצמאי', pickerName: null, checkerName: null, lineCount: 1, totalQuantity: 10 }
        ]
      };

      // routeGroupWorkBucketSummaries does NOT include standaloneBucket
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        selectedRouteGroupKey: 'galil-general',
        selectedWorkBucketKey: 'wb-standalone',
        selectedRouteGroupWorkBucket: standaloneBucket,
        selectedWorkBucketName: 'עצמאי',
        areaSummaries: [mockGalilArea],
        areaLineSummaries: [mockGalilLineSummary],
        lineHierarchySummaries: [mockGalilLineSummary],
        hasRouteGroups: true,
        routeGroupSummaries: [mockGalilRouteGroup],
        routeGroupWorkBucketSummaries: [mockRouteGroupWBKlali], // different list!
        showProductRollupDeferred: false,
        workBucketView: 'orders'
      });

      // The standalone bucket's order must render (source: selectedRouteGroupWorkBucket)
      expect(screen.getByTestId('order-mini-card-s-o-1')).toBeTruthy();
      // The klali bucket's orders must NOT render (they are not in selectedRouteGroupWorkBucket)
      expect(screen.queryByTestId('order-mini-card-g-o-1')).toBeNull();
    });
  });

  describe('delivery channel lineKind display', () => {
    const deliveryLine: LineHierarchySummary = {
      lineId: 'line-chita',
      lineName: "צ'יטה",
      lineKind: 'delivery_channel',
      distributionArea: 'שפלה 1',
      lineStatus: 'open',
      ordersCount: 2,
      itemLinesCount: 4,
      totalQuantity: 20,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
    };

    const normalLine: LineHierarchySummary = {
      lineId: 'line-galil',
      lineName: 'גליל',
      distributionArea: 'גליל',
      lineStatus: 'open',
      ordersCount: 4,
      itemLinesCount: 10,
      totalQuantity: 100,
      statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
    };

    it('shows "ערוץ משלוח:" for delivery_channel in breadcrumb', () => {
      renderPanel({
        selectedAreaKey: 'שפלה 1',
        selectedLineId: 'line-chita',
        lineHierarchySummaries: [deliveryLine],
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText(`ערוץ משלוח: צ'יטה`)).toBeTruthy();
    });

    it('shows "קו:" for normal line in breadcrumb', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        lineHierarchySummaries: [normalLine],
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('קו: גליל')).toBeTruthy();
    });

    it('shows "ערוץ משלוח:" in auto-skipped single-line area for delivery_channel', () => {
      renderPanel({
        selectedAreaKey: 'שפלה 1',
        selectedLineId: 'line-chita',
        areaLineSummaries: [deliveryLine],
        lineHierarchySummaries: [deliveryLine],
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText(`ערוץ משלוח: צ'יטה`)).toBeTruthy();
      expect(screen.queryByText('קו הפצה:')).toBeNull();
    });

    it('shows "קו הפצה:" in auto-skipped single-line area for normal line', () => {
      renderPanel({
        selectedAreaKey: 'גליל',
        selectedLineId: 'line-galil',
        areaLineSummaries: [normalLine],
        lineHierarchySummaries: [normalLine],
        workBucketSummaries: mockWorkBucketSummaries
      });
      expect(screen.getByText('קו הפצה: גליל')).toBeTruthy();
      expect(screen.queryByText('ערוץ משלוח:')).toBeNull();
    });
  });

  describe('print action — line-level and detail', () => {
    it('shows line-level print action when all required params exist', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });
      expect(screen.getByTestId('print-picker-sheet-line')).toBeTruthy();
    });

    it('hides line-level print action when shiftId is null', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: null
      });
      expect(screen.queryByTestId('print-picker-sheet-line')).toBeNull();
    });

    it('hides line-level print action when distributionArea is missing on the line', () => {
      renderPanel({
        selectedAreaKey: 'דרום',
        selectedLineId: 'line-2',
        lineHierarchySummaries: [mockLineHierarchySummaries[1]],
        areaLineSummaries: [mockLineHierarchySummaries[1]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });
      expect(screen.queryByTestId('print-picker-sheet-line')).toBeNull();
    });

    it('line-level PDF action calls blob helper with PDF endpoint and correct params', async () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      fireEvent.click(screen.getByTestId('print-picker-sheet-line'));

      await waitFor(() => {
        expect(bffRequestBlob).toHaveBeenCalledOnce();
      });
      const pdfUrl = vi.mocked(bffRequestBlob).mock.calls[0][0];
      expect(pdfUrl).toContain('/api/manual-shifts/shift-1/print/picker-sheet.pdf');
      const params = new URLSearchParams(pdfUrl.split('?')[1]);
      expect(params.get('scope')).toBe('line');
      expect(params.get('distributionArea')).toBe('צפון');
      expect(params.get('planningLineName')).toBe('Line South');
      expect(params.has('workGroupName')).toBe(false);
      expect(params.has('shiftId')).toBe(false);
      expect(pdfUrl).not.toContain('access_token');
    });

    it('detail view shows print action link when bucket is selected with all params', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        selectedWorkBucketName: 'Point A',
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });
      expect(screen.getByTestId('print-picker-sheet-detail')).toBeTruthy();
    });

    it('detail view hides print action link when shiftId is null', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        selectedWorkBucketName: 'Point A',
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: null
      });
      expect(screen.queryByTestId('print-picker-sheet-detail')).toBeNull();
    });

    it('line-level PDF action shows loading state while request is pending', async () => {
      let resolveRequest: ((value: { blob: Blob; filename: string }) => void) | undefined;
      vi.mocked(bffRequestBlob).mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
      );

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      fireEvent.click(screen.getByTestId('print-picker-sheet-line'));
      expect(await screen.findByText('מכין PDF...')).toBeTruthy();

      resolveRequest?.({ blob: pdfBlob, filename: 'picker-sheet.pdf' });
      await waitFor(() => {
        expect(screen.getByTestId('print-picker-sheet-line').textContent).toContain('פתח PDF דף ליקוט');
      });
    });

    it('line-level PDF success opens a blank tab and navigates it to a blob URL', async () => {
      const pdfWindow = { location: { href: '' }, close: vi.fn(), opener: window };
      vi.mocked(window.open).mockReturnValue(pdfWindow as unknown as Window);

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      fireEvent.click(screen.getByTestId('print-picker-sheet-line'));

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalledWith(pdfBlob);
        expect(pdfWindow.location.href).toBe('blob:picker-sheet');
      });
      expect(window.open).toHaveBeenCalledWith('', '_blank');
      expect(pdfWindow.opener).toBeNull();
    });

    it('line-level PDF failure shows error and closes the blank tab', async () => {
      const pdfWindow = { location: { href: '' }, close: vi.fn(), opener: window };
      vi.mocked(window.open).mockReturnValue(pdfWindow as unknown as Window);
      vi.mocked(bffRequestBlob).mockRejectedValue(new Error('PDF failed'));

      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      fireEvent.click(screen.getByTestId('print-picker-sheet-line'));

      expect((await screen.findByRole('alert')).textContent).toContain('PDF failed');
      expect(pdfWindow.close).toHaveBeenCalledOnce();
    });

    it('detail PDF action calls blob helper with workGroup scope', async () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        selectedWorkBucketName: 'Point A',
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      fireEvent.click(screen.getByTestId('print-picker-sheet-detail'));

      await waitFor(() => {
        expect(bffRequestBlob).toHaveBeenCalledOnce();
      });
      const pdfUrl = vi.mocked(bffRequestBlob).mock.calls[0][0];
      expect(pdfUrl).toContain('/api/manual-shifts/shift-1/print/picker-sheet.pdf');
      const params = new URLSearchParams(pdfUrl.split('?')[1]);
      expect(params.get('scope')).toBe('workGroup');
      expect(params.get('distributionArea')).toBe('צפון');
      expect(params.get('planningLineName')).toBe('Line South');
      expect(params.get('workGroupName')).toBe('Point A');
      expect(params.has('shiftId')).toBe(false);
    });

    it('keeps HTML preview route as secondary action', () => {
      renderPanel({
        selectedAreaKey: 'צפון',
        selectedLineId: 'line-1',
        lineHierarchySummaries: [mockLineHierarchySummaries[0]],
        workBucketSummaries: mockWorkBucketSummaries,
        shiftId: 'shift-1'
      });

      const previewLink = screen.getByTestId('print-picker-sheet-line-preview');
      const href = previewLink.getAttribute('href') ?? '';
      expect(href).toContain('/operator/manual/print/picker-sheet');
      expect(href).toContain('shiftId=shift-1');
    });
  });
});
