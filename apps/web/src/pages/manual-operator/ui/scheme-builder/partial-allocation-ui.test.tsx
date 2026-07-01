// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { OrderCard } from './order-card';
import { ItemsDrawerV2 } from './items-drawer-v2';
import { QuantityAllocationModal } from './quantity-allocation-modal';
import { useSchemeBuilderStore } from './scheme-store';
import type { SchemeBuilderCapabilities, SourceOrder, SourceOrderItem } from './scheme-types';

const capabilities: SchemeBuilderCapabilities = {
  canCreatePlanningLines: true,
  canCreateWorkGroups: true,
  canAssignOrders: true,
  canMoveOrders: true,
  canSaveDraft: true,
  canPublishToShift: true,
  canWriteManualShift: true,
  canPrint: false,
};

const order: SourceOrder = {
  orderId: 'order-1',
  orderNumber: 'SO-1',
  customerName: 'Customer',
  pointName: null,
  sourceZone: null,
  backendStatus: 'queued',
  totalQuantity: 12,
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

const item: SourceOrderItem = {
  id: 'row-1',
  orderId: 'order-1',
  sku: 'SKU-1',
  description: 'Product 1',
  category: 'regular',
  quantity: 12,
  notes: null,
  zone: null,
  sourceRows: null,
  sourceFile: null,
};

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAllocations: [],
    targetWorkGroupId: null,
  });
}

function PartialAllocationHarness() {
  const itemAllocations = useSchemeBuilderStore((s) => s.itemAllocations);
  const allocateItemQty = useSchemeBuilderStore((s) => s.allocateItemQty);
  const assignedQty = itemAllocations
    .filter((allocation) => allocation.itemRowId === item.id)
    .reduce((sum, allocation) => sum + allocation.qty, 0);
  const remainingQty = item.quantity - assignedQty;

  return (
    <>
      <OrderCard
        order={order}
        orderItemMap={{ [order.orderId]: [item] }}
        itemAllocations={itemAllocations}
        onClick={() => {}}
      />
      <ItemsDrawerV2
        order={order}
        items={[item]}
        isLoading={false}
        isError={false}
        onClose={() => {}}
        onAssignSelected={() => {}}
        onAssignAllUnassigned={() => {}}
        targetWorkGroupName={null}
        capabilities={capabilities}
      />
      <QuantityAllocationModal
        isOpen={true}
        onClose={() => {}}
        workGroupName="Group A"
        itemRows={[{ item, assignedQty, remainingQty }]}
        onConfirm={(allocations) => {
          for (const allocation of allocations) {
            allocateItemQty({
              itemRowId: allocation.itemRowId,
              workGroupId: 'wg-1',
              qty: allocation.qty,
              totalQty: item.quantity,
            });
          }
        }}
      />
    </>
  );
}

describe('partial quantity allocation UI', () => {
  beforeEach(() => {
    resetStore();
  });

  it('keeps the row and order partial when the user enters 6 out of 12', () => {
    render(<PartialAllocationHarness />);

    fireEvent.change(screen.getByDisplayValue('12'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'אשר הקצאה לשורות המסומנות' }));

    expect(useSchemeBuilderStore.getState().getAssignedQty('row-1')).toBe(6);
    expect(screen.getByText(/6\/12/)).toBeInTheDocument();
    expect(screen.getAllByText('שובץ חלקית').length).toBeGreaterThan(0);

    const rowElement = screen.getAllByText('SKU-1')[0].closest('tr');
    expect(rowElement).not.toBeNull();
    const row = within(rowElement!);
    expect(row.getByText('12')).toBeInTheDocument();
    expect(row.getAllByText('6')).toHaveLength(2);
  });
});
