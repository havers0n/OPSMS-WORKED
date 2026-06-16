import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopHierarchyPanel } from '../desktop-hierarchy-panel';
import type { LineHierarchySummary, PointHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

const mockLineHierarchySummaries: LineHierarchySummary[] = [
  {
    lineId: 'line-1',
    lineName: 'שרון',
    lineStatus: 'in_progress',
    ordersCount: 5,
    itemLinesCount: 12,
    totalQuantity: 64,
    statusBreakdown: { queued: 2, picking: 1, waitingCheck: 1, returned: 0, done: 1 }
  },
  {
    lineId: 'line-2',
    lineName: 'דרום',
    lineStatus: 'open',
    ordersCount: 3,
    itemLinesCount: 6,
    totalQuantity: 20,
    statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 }
  }
];

const mockPointSummaries: PointHierarchySummary[] = [
  {
    pointName: 'ג.גפנר',
    ordersCount: 2,
    itemLinesCount: 5,
    totalQuantity: 32,
    statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 1, done: 0 },
    orders: [
      {
        orderId: 'order-1',
        orderNumber: 'SO26015545',
        status: 'picking',
        pointName: 'ג.גפנר',
        pickerName: 'דוד',
        checkerName: null,
        lineCount: 3,
        totalQuantity: 20
      },
      {
        orderId: 'order-2',
        orderNumber: 'SO26015546',
        status: 'returned',
        pointName: 'ג.גפנר',
        pickerName: null,
        checkerName: null,
        lineCount: 2,
        totalQuantity: 12
      }
    ]
  },
  {
    pointName: 'ללא נקודה',
    ordersCount: 1,
    itemLinesCount: 2,
    totalQuantity: 10,
    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    orders: [
      {
        orderId: 'order-3',
        orderNumber: null,
        status: 'queued',
        pointName: 'ללא נקודה',
        pickerName: null,
        checkerName: null,
        lineCount: 2,
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
        selectedPointName={null}
        lineHierarchySummaries={mockLineHierarchySummaries}
        pointSummaries={[]}
        onSelectLine={noop}
        onSelectPoint={noop}
        onSelectOrder={noop}
        onClearLine={noop}
        onClearPoint={noop}
        {...overrides}
      />
    );
  }

  describe('default state (no selected line)', () => {
    it('shows line summary cards, not flat order table', () => {
      renderPanel();
      expect(screen.getByText('קווים')).toBeTruthy();
      expect(screen.getByTestId('line-summary-card-line-1')).toBeTruthy();
      expect(screen.getByTestId('line-summary-card-line-2')).toBeTruthy();
    });

    it('shows line name and stats on each card', () => {
      renderPanel();
      expect(screen.getByText('שרון')).toBeTruthy();
      expect(screen.getByText('דרום')).toBeTruthy();
      expect(screen.getByText('5 הזמנות')).toBeTruthy();
      expect(screen.getByText('3 הזמנות')).toBeTruthy();
    });

    it('calls onSelectLine when a line card is clicked', () => {
      const onSelectLine = vi.fn();
      renderPanel({ onSelectLine });
      fireEvent.click(screen.getByTestId('line-summary-card-line-1'));
      expect(onSelectLine).toHaveBeenCalledWith('line-1');
    });

    it('shows empty state when no lines', () => {
      renderPanel({ lineHierarchySummaries: [] });
      expect(screen.getByText('אין קווים פעילים')).toBeTruthy();
    });
  });

  describe('selected line (showing points)', () => {
    it('shows point groups when a line is selected', () => {
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: mockPointSummaries
      });
      expect(screen.getByText('ג.גפנר')).toBeTruthy();
      expect(screen.getByText('ללא נקודה')).toBeTruthy();
    });

    it('shows breadcrumb with line name', () => {
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: mockPointSummaries
      });
      expect(screen.getByText('קו: שרון')).toBeTruthy();
    });

    it('calls onSelectPoint when a point card is clicked', () => {
      const onSelectPoint = vi.fn();
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: mockPointSummaries,
        onSelectPoint
      });
      fireEvent.click(screen.getByTestId('point-group-card-ג.גפנר'));
      expect(onSelectPoint).toHaveBeenCalledWith('ג.גפנר');
    });

    it('calls onClearLine when breadcrumb "קווים" link is clicked', () => {
      const onClearLine = vi.fn();
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: mockPointSummaries,
        onClearLine
      });
      fireEvent.click(screen.getByLabelText('חזרה לקווים'));
      expect(onClearLine).toHaveBeenCalledOnce();
    });

    it('shows empty state when no points in selected line', () => {
      renderPanel({
        selectedLineId: 'line-1',
        pointSummaries: []
      });
      expect(screen.getByText('אין נקודות בקו זה')).toBeTruthy();
    });
  });

  describe('selected point (showing orders)', () => {
    it('shows order mini cards for selected point', () => {
      renderPanel({
        selectedLineId: 'line-1',
        selectedPointName: 'ג.גפנר',
        pointSummaries: mockPointSummaries
      });
      expect(screen.getByTestId('order-mini-card-order-1')).toBeTruthy();
      expect(screen.getByTestId('order-mini-card-order-2')).toBeTruthy();
    });

    it('shows breadcrumb with line name AND point name', () => {
      renderPanel({
        selectedLineId: 'line-1',
        selectedPointName: 'ג.גפנר',
        pointSummaries: mockPointSummaries
      });
      expect(screen.getByText('נקודה: ג.גפנר')).toBeTruthy();
    });

    it('calls onSelectOrder when an order card is clicked', () => {
      const onSelectOrder = vi.fn();
      renderPanel({
        selectedLineId: 'line-1',
        selectedPointName: 'ג.גפנר',
        pointSummaries: mockPointSummaries,
        onSelectOrder
      });
      fireEvent.click(screen.getByTestId('order-mini-card-order-1'));
      expect(onSelectOrder).toHaveBeenCalledWith('order-1');
    });

    it('calls onClearPoint when breadcrumb line link is clicked', () => {
      const onClearPoint = vi.fn();
      renderPanel({
        selectedLineId: 'line-1',
        selectedPointName: 'ג.גפנר',
        pointSummaries: mockPointSummaries,
        onClearPoint
      });
      fireEvent.click(screen.getByLabelText('חזרה לנקודות קו שרון'));
      expect(onClearPoint).toHaveBeenCalledOnce();
    });
  });
});