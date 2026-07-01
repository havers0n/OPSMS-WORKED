// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ItemsDrawerV2 } from './items-drawer-v2';
import { useSchemeBuilderStore } from './scheme-store';
import type { SourceOrder, SourceOrderItem } from './scheme-types';

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAllocations: [],
    targetWorkGroupId: null,
  });
}

function makeOrder(): SourceOrder {
  return {
    orderId: 'order-1',
    orderNumber: 'SO-001',
    customerName: 'לקוח א',
    pointName: null,
    sourceZone: null,
    backendStatus: 'queued',
    totalQuantity: 5,
    itemLinesCount: 5,
    hasAshlama: false,
    hasCheckUnits: false,
    sourceDeliveryLine: null,
    areaName: 'דרום',
    areaDisplayName: 'דרום',
    deliveryPointId: null,
    deliveryPointName: null,
    deliveryPointMatchStatus: null,
    rawDestinationLabel: null,
  };
}

function makeItems(): SourceOrderItem[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    id: `row-${n}`,
    orderId: 'order-1',
    sku: `SKU-${n}`,
    description: `מוצר ${n}`,
    category: 'כללי',
    quantity: 1,
    notes: null,
    zone: null,
    sourceRows: null,
    sourceFile: null,
  }));
}

describe('ItemsDrawerV2', () => {
  beforeEach(() => {
    resetStore();
  });

  it('passes only the selected rows to Assign Selected', () => {
    const onAssignSelected = vi.fn();
    render(
      <ItemsDrawerV2
        order={makeOrder()}
        items={makeItems()}
        isLoading={false}
        isError={false}
        onClose={() => {}}
        onAssignSelected={onAssignSelected}
        onAssignAllUnassigned={() => {}}
        targetWorkGroupName={null}
        capabilities={{
          canCreatePlanningLines: false,
          canCreateWorkGroups: false,
          canAssignOrders: true,
          canMoveOrders: false,
          canSaveDraft: false,
          canPublishToShift: false,
          canWriteManualShift: false,
          canPrint: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'בחר שורה SKU-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'בחר שורה SKU-4' }));
    fireEvent.click(screen.getByRole('button', { name: /שייך שורות מסומנות בלבד/ }));

    expect(onAssignSelected).toHaveBeenCalledTimes(1);
    expect(onAssignSelected).toHaveBeenCalledWith(['row-2', 'row-4']);
  });

  it('passes all unassigned rows only when the explicit all-unassigned button is used', () => {
    const onAssignAllUnassigned = vi.fn();
    render(
      <ItemsDrawerV2
        order={makeOrder()}
        items={makeItems()}
        isLoading={false}
        isError={false}
        onClose={() => {}}
        onAssignSelected={() => {}}
        onAssignAllUnassigned={onAssignAllUnassigned}
        targetWorkGroupName={null}
        capabilities={{
          canCreatePlanningLines: false,
          canCreateWorkGroups: false,
          canAssignOrders: true,
          canMoveOrders: false,
          canSaveDraft: false,
          canPublishToShift: false,
          canWriteManualShift: false,
          canPrint: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'בחר את כל השורות שלא שובצו' }));
    fireEvent.click(screen.getByRole('button', { name: /שייך את כל השורות הפנויות/ }));

    expect(onAssignAllUnassigned).toHaveBeenCalledTimes(1);
    expect(onAssignAllUnassigned).toHaveBeenCalledWith(['row-1', 'row-2', 'row-3', 'row-4', 'row-5']);
  });
});
