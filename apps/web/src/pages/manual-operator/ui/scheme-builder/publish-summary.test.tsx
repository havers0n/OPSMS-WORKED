import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishSummary } from './publish-summary';
import { useSchemeBuilderStore } from './scheme-store';
import type { SourceOrder, RollingPublishConflict } from './scheme-types';

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

  it('renders stale conflict section when publishConflicts are provided', () => {
    const conflicts: RollingPublishConflict[] = [
      {
        allocationId: 'a0000000-0000-4000-8000-000000000001',
        rawDemandRowId: 'r0000000-0000-4000-8000-000000000001',
        sku: 'SKU-001',
        orderNumber: 'SO-123',
        requestedQuantity: 10,
        availableQuantity: 0,
        status: 'stale',
        reason: 'Raw demand row no longer represents the latest batch for this order+sku combination.',
      },
      {
        allocationId: 'a0000000-0000-4000-8000-000000000002',
        rawDemandRowId: 'r0000000-0000-4000-8000-000000000002',
        sku: 'SKU-002',
        orderNumber: 'SO-456',
        requestedQuantity: 20,
        availableQuantity: 5,
        status: 'insufficient_quantity',
        reason: 'Requested 20 but only 5 available.',
      },
    ];

    render(
      <PublishSummary
        orders={[makeOrder('order-1')]}
        orderItemMap={{}}
        publishError="הביקוש השתנה מאז יצירת הטיוטה"
        publishConflicts={conflicts}
      />,
    );

    expect(screen.getByText('2 שורות לא ניתן לפרסם בגלל שינוי בביקוש הזמין')).toBeInTheDocument();
    expect(screen.getByText('חלק מהשורות כבר אינן זמינות לפרסום. יש לרענן את הטיוטה או לשנות את השיוך.')).toBeInTheDocument();

    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('SO-123')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('בטיוטה:') && content.includes('10'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('זמין:') && content.includes('0'))).toBeInTheDocument();
    expect(screen.getByText('לא עדכני')).toBeInTheDocument();

    expect(screen.getByText('SKU-002')).toBeInTheDocument();
    expect(screen.getByText('SO-456')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('בטיוטה:') && content.includes('20'))).toBeInTheDocument();
    expect(screen.getByText('כמות לא מספיקה')).toBeInTheDocument();
  });

  it('renders generic error message when publishConflicts is undefined', () => {
    render(
      <PublishSummary
        orders={[makeOrder('order-1')]}
        orderItemMap={{}}
        publishError="אין הרשאה לפרסם למשמרת הזו"
      />,
    );

    expect(screen.getByText('אין הרשאה לפרסם למשמרת הזו')).toBeInTheDocument();
    expect(screen.queryByText(/לא ניתן לפרסם/)).toBeNull();
  });

  it('renders generic error when publishConflicts is empty array', () => {
    render(
      <PublishSummary
        orders={[makeOrder('order-1')]}
        orderItemMap={{}}
        publishError="הביקוש השתנה מאז יצירת הטיוטה"
        publishConflicts={[]}
      />,
    );

    expect(screen.getByText('הביקוש השתנה מאז יצירת הטיוטה')).toBeInTheDocument();
    expect(screen.queryByText(/שורות לא ניתן לפרסם/)).toBeNull();
  });
});
