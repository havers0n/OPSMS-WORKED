import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishSummary } from './publish-summary';
import { useSchemeBuilderStore } from './scheme-store';
import type { SourceOrder } from './scheme-types';

function makeOrder(id: string): SourceOrder {
  return {
    orderId: id,
    orderNumber: id,
    customerName: 'Customer',
    pointName: null,
    sourceZone: null,
    backendStatus: 'queued',
    totalQuantity: 1,
    itemLinesCount: 1,
    hasAshlama: false,
    hasCheckUnits: false,
    sourceDeliveryLine: null,
    areaName: 'North',
    areaDisplayName: 'North',
    deliveryPointId: null,
    deliveryPointName: null,
    deliveryPointMatchStatus: null,
    rawDestinationLabel: null,
  };
}

function expectMetric(label: string, value: string) {
  const metric = screen.getByText(label).parentElement;
  expect(metric).not.toBeNull();
  expect(within(metric as HTMLElement).getByText(value)).toBeTruthy();
}

describe('PublishSummary', () => {
  beforeEach(() => {
    useSchemeBuilderStore.getState().clearLocalDraft();
  });

  it('excludes default planning lines and unassigned work groups from main KPIs', () => {
    useSchemeBuilderStore.setState({
      planningLines: [
        { id: 'pl-tech', areaName: 'North', name: 'default', sortOrder: 0, createdAt: 0 },
        { id: 'pl-user', areaName: 'North', name: 'Line A', sortOrder: 1, createdAt: 0 },
      ],
      workGroups: [
        { id: 'wg-tech', planningLineId: 'pl-tech', areaName: 'North', name: 'unassigned', createdAt: 0 },
        { id: 'wg-user', planningLineId: 'pl-user', areaName: 'North', name: 'Group A', createdAt: 0 },
      ],
      itemAllocations: [],
    });

    render(<PublishSummary orders={[makeOrder('order-1')]} orderItemMap={{}} />);

    expectMetric('קווי עבודה', '1');
    expectMetric('קבוצות עבודה', '1');
  });

  it('shows zero user planning lines and work groups when only technical entities exist', () => {
    useSchemeBuilderStore.setState({
      planningLines: [
        { id: 'pl-tech', areaName: 'North', name: 'default', sortOrder: 0, createdAt: 0 },
      ],
      workGroups: [
        { id: 'wg-tech', planningLineId: 'pl-tech', areaName: 'North', name: 'unassigned', createdAt: 0 },
      ],
      itemAllocations: [],
    });

    render(<PublishSummary orders={[makeOrder('1'), makeOrder('2'), makeOrder('3'), makeOrder('4')]} orderItemMap={{}} />);

    expectMetric('קווי עבודה', '0');
    expectMetric('קבוצות עבודה', '0');
    expectMetric('הזמנות', '4');
  });
});
