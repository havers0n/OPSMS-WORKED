import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RouteGroupWorkBucketSummary, WorkBucketSummary } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopWorkBucketCard } from '../desktop-work-bucket-card';

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

    render(<DesktopWorkBucketCard bucket={bucket} onClick={onClick} />);

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

    render(<DesktopWorkBucketCard bucket={bucket} routeGroupName="גליל כללי" onClick={onClick} />);

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

    render(
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
});
