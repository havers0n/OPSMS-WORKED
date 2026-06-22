import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RouteGroupWorkBucketSummary, WorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopWorkBucketCard } from '../desktop-work-bucket-card';

function renderCard(element: React.ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe('DesktopWorkBucketCard', () => {
  it('passes the legacy bucket name for non-route-group buckets', () => {
    const onClick = vi.fn();
    const bucket: WorkBucketSummary = {
      workBucketName: 'Point A',
      ordersCount: 2,
      itemLinesCount: 3,
      totalQuantity: 12,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: []
    };

    renderCard(<DesktopWorkBucketCard bucket={bucket} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('work-bucket-card-Point A'));
    expect(onClick).toHaveBeenCalledWith('Point A');
  });

  it('passes the stable workBucketKey for route-group buckets', () => {
    const onClick = vi.fn();
    const bucket: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-klali',
      workBucketName: 'כללי',
      workBucketDisplayName: 'כללי',
      classificationConfidence: 'high',
      orderCount: 3,
      itemLinesCount: 7,
      totalQuantity: 60,
      statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: []
    };

    renderCard(<DesktopWorkBucketCard bucket={bucket} routeGroupName="גליל כללי" onClick={onClick} />);

    fireEvent.click(screen.getByTestId('work-bucket-card-wb-klali'));
    expect(onClick).toHaveBeenCalledWith('wb-klali');
    expect(screen.getByRole('button', { name: 'קבוצת עבודה כללי' })).toBeTruthy();
  });

  it('keeps repeated display buckets distinct by key', () => {
    const onClick = vi.fn();
    const galilBucket: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-galil',
      workBucketName: 'כללי',
      workBucketDisplayName: 'כללי',
      classificationConfidence: 'high',
      orderCount: 3,
      itemLinesCount: 7,
      totalQuantity: 60,
      statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: []
    };
    const dabachBucket: RouteGroupWorkBucketSummary = {
      workBucketKey: 'wb-dabach',
      workBucketName: 'כללי',
      workBucketDisplayName: 'כללי',
      classificationConfidence: 'high',
      orderCount: 2,
      itemLinesCount: 5,
      totalQuantity: 30,
      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: []
    };

    renderCard(
      <div>
        <DesktopWorkBucketCard bucket={galilBucket} routeGroupName="גליל כללי" onClick={onClick} />
        <DesktopWorkBucketCard bucket={dabachBucket} routeGroupName="דבאח עין המפרץ" onClick={onClick} />
      </div>
    );

    fireEvent.click(screen.getByTestId('work-bucket-card-wb-galil'));
    fireEvent.click(screen.getByTestId('work-bucket-card-wb-dabach'));

    expect(onClick).toHaveBeenNthCalledWith(1, 'wb-galil');
    expect(onClick).toHaveBeenNthCalledWith(2, 'wb-dabach');
  });

  describe('print action', () => {
    it('renders print link when printUrl is provided', () => {
      const bucket: WorkBucketSummary = {
        workBucketName: 'Point A',
        ordersCount: 2,
        itemLinesCount: 3,
        totalQuantity: 12,
        statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      renderCard(<DesktopWorkBucketCard bucket={bucket} printUrl="/print/test" />);

      expect(screen.getByTestId('print-picker-sheet-link')).toBeTruthy();
      expect(screen.getByText('הדפס דף ליקוט')).toBeTruthy();
    });

    it('hides print link when printUrl is absent', () => {
      const bucket: WorkBucketSummary = {
        workBucketName: 'Point A',
        ordersCount: 2,
        itemLinesCount: 3,
        totalQuantity: 12,
        statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      renderCard(<DesktopWorkBucketCard bucket={bucket} />);

      expect(screen.queryByTestId('print-picker-sheet-link')).toBeNull();
      expect(screen.queryByText('הדפס דף ליקוט')).toBeNull();
    });

    it('opens in new tab with correct attributes', () => {
      const bucket: WorkBucketSummary = {
        workBucketName: 'Point A',
        ordersCount: 2,
        itemLinesCount: 3,
        totalQuantity: 12,
        statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      renderCard(<DesktopWorkBucketCard bucket={bucket} printUrl="/print/test" />);

      const link = screen.getByTestId('print-picker-sheet-link');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does not trigger card onClick when print link is clicked', () => {
      const onClick = vi.fn();
      const bucket: WorkBucketSummary = {
        workBucketName: 'Point A',
        ordersCount: 2,
        itemLinesCount: 3,
        totalQuantity: 12,
        statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      renderCard(<DesktopWorkBucketCard bucket={bucket} onClick={onClick} printUrl="/print/test" />);

      fireEvent.click(screen.getByTestId('print-picker-sheet-link'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('has no nested interactive elements — link is sibling of button, not child', () => {
      const bucket: WorkBucketSummary = {
        workBucketName: 'Point A',
        ordersCount: 2,
        itemLinesCount: 3,
        totalQuantity: 12,
        statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      const { container } = renderCard(<DesktopWorkBucketCard bucket={bucket} printUrl="/print/test" />);

      const button = container.querySelector('button');
      const link = container.querySelector('a');
      expect(button).toBeTruthy();
      expect(link).toBeTruthy();
      expect(button?.contains(link)).toBe(false);
    });

    it('includes encoded query params in the print URL', () => {
      const bucket: RouteGroupWorkBucketSummary = {
        workBucketKey: 'wb-klali',
        workBucketName: 'כללי',
        workBucketDisplayName: 'כללי',
        classificationConfidence: 'high',
        orderCount: 3,
        itemLinesCount: 7,
        totalQuantity: 60,
        statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        orders: []
      };

      const printUrl = '/operator/manual/print/picker-sheet?shiftId=shift-1&distributionArea=%D7%A6%D7%A4%D7%95%D7%9F&scope=workGroup&planningLineName=%D7%A7%D7%95+%D7%A6%D7%A4%D7%95%D7%9F&workGroupName=%D7%9B%D7%9C%D7%9C%D7%99';
      renderCard(<DesktopWorkBucketCard bucket={bucket} printUrl={printUrl} />);

      const link = screen.getByTestId('print-picker-sheet-link');
      const href = link.getAttribute('href');
      const params = new URLSearchParams(href!.split('?')[1]);
      expect(params.get('shiftId')).toBe('shift-1');
      expect(params.get('scope')).toBe('workGroup');
      expect(params.get('distributionArea')).toBe('צפון');
      expect(params.get('planningLineName')).toBe('קו צפון');
      expect(params.get('workGroupName')).toBe('כללי');
    });
  });
});
