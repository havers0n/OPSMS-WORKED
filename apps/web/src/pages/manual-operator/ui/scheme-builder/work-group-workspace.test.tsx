import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkGroupWorkspace } from './work-group-workspace';
import { PublishSummary } from './publish-summary';
import { useSchemeBuilderStore } from './scheme-store';
import type { SchemeBuilderCapabilities, SourceOrder } from './scheme-types';

vi.mock('@/entities/manual-shift/api/mutations', () => ({
  useCreateLine: () => ({ mutateAsync: vi.fn() }),
  usePatchManualShiftOrder: () => ({ mutateAsync: vi.fn() }),
}));

const capabilities: SchemeBuilderCapabilities = {
  canCreatePlanningLines: true,
  canCreateWorkGroups: true,
  canAssignOrders: true,
  canMoveOrders: true,
  canSaveDraft: true,
  canPublishToShift: true,
  canWriteManualShift: false,
  canPrint: false,
};

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

function renderWorkspace(input?: {
  orders?: SourceOrder[];
  isShiftMode?: boolean;
  onShowUnassignedOrders?: () => void;
}) {
  return render(
    <WorkGroupWorkspace
      selectedAreaName="North"
      orderItemMap={{}}
      onStartAssign={vi.fn()}
      capabilities={capabilities}
      orderNumberMap={{}}
      sourceOrders={input?.orders ?? []}
      isShiftMode={input?.isShiftMode ?? false}
      shiftId={null}
      onShowUnassignedOrders={input?.onShowUnassignedOrders}
    />,
  );
}

describe('WorkGroupWorkspace demand empty state', () => {
  beforeEach(() => {
    useSchemeBuilderStore.getState().clearLocalDraft();
  });

  it('shows demand-aware empty state and zero user summary counts for orders with only technical entities', () => {
    const orders = [makeOrder('1'), makeOrder('2'), makeOrder('3'), makeOrder('4')];
    useSchemeBuilderStore.setState({
      planningLines: [
        { id: 'pl-tech', areaName: 'North', name: 'default', sortOrder: 0, createdAt: 0 },
      ],
      workGroups: [
        { id: 'wg-tech', planningLineId: 'pl-tech', areaName: 'North', name: 'unassigned', createdAt: 0 },
      ],
      itemAllocations: [],
    });

    render(
      <>
        <PublishSummary orders={orders} orderItemMap={{}} />
        <WorkGroupWorkspace
          selectedAreaName="North"
          orderItemMap={{}}
          onStartAssign={vi.fn()}
          capabilities={capabilities}
          orderNumberMap={{}}
          sourceOrders={orders}
          isShiftMode={false}
          shiftId={null}
        />
      </>,
    );

    expect(screen.getByText('יש 4 הזמנות שממתינות לתכנון')).toBeTruthy();
    expect(screen.getByText('עדיין לא נוצרו קווי עבודה באזור זה')).toBeTruthy();
    expect(screen.getAllByText('קווי עבודה')[0].parentElement?.textContent).toContain('0');
    expect(screen.getByText('קבוצות עבודה').parentElement?.textContent).toContain('0');
  });

  it('opens the existing create-line modal from the primary CTA', () => {
    renderWorkspace({ orders: [makeOrder('1')] });

    fireEvent.click(screen.getByRole('button', { name: /צור קו עבודה ראשון/ }));

    expect(screen.getByText('בחר איך ליצור קו עבודה')).toBeTruthy();
  });

  it('reveals unassigned orders through the secondary CTA', () => {
    const onShowUnassignedOrders = vi.fn();
    renderWorkspace({ orders: [makeOrder('1')], onShowUnassignedOrders });

    fireEvent.click(screen.getByRole('button', { name: /הצג הזמנות שלא שויכו/ }));

    expect(onShowUnassignedOrders).toHaveBeenCalledTimes(1);
  });

  it('keeps the true empty state when there are no orders and no lines', () => {
    renderWorkspace();

    expect(screen.queryByText(/הזמנות שממתינות לתכנון/)).toBeNull();
    expect(screen.getByText('יש ליצור קווי עבודה ולשייך אליהן קבוצות עבודה ושורות מוצר.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^צור קו עבודה$/ })).toBeTruthy();
  });

  it('keeps the group-specific empty state when a visible line has no groups', () => {
    useSchemeBuilderStore.setState({
      planningLines: [
        { id: 'pl-user', areaName: 'North', name: 'Line A', sortOrder: 0, createdAt: 0 },
      ],
      workGroups: [],
      itemAllocations: [],
    });

    renderWorkspace({ orders: [makeOrder('1')] });

    expect(screen.queryByText(/הזמנות שממתינות לתכנון/)).toBeNull();
    expect(screen.getByText('אין קבוצות עבודה בקו זה')).toBeTruthy();
  });
});
