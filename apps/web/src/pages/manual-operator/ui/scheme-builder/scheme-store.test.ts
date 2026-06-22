import { describe, expect, it, beforeEach } from 'vitest';
import { useSchemeBuilderStore, getOrderSplitStatus } from './scheme-store';
import type { SourceOrderItem } from './scheme-types';

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    workGroups: [],
    itemAssignments: {},
  });
}

describe('scheme-store', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates a work group and returns its id', () => {
    const store = useSchemeBuilderStore.getState();
    const id = store.createWorkGroup('south', 'קבוצה 1');
    expect(id).toBeTruthy();
    const wg = store.getWorkGroup(id);
    expect(wg).toBeTruthy();
    expect(wg!.name).toBe('קבוצה 1');
    expect(wg!.areaName).toBe('south');
  });

  it('assigns items by itemRowId, not orderId', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignItemRows(['item-1', 'item-2'], wgId);

    const state = useSchemeBuilderStore.getState();
    expect(state.itemAssignments['item-1']).toBe(wgId);
    expect(state.itemAssignments['item-2']).toBe(wgId);
    expect(state.itemAssignments['item-3']).toBeUndefined();
  });

  it('whole-order shortcut assigns all given unassigned item rows', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignWholeOrder(['item-a', 'item-b', 'item-c'], wgId);

    const state = useSchemeBuilderStore.getState();
    expect(state.itemAssignments['item-a']).toBe(wgId);
    expect(state.itemAssignments['item-b']).toBe(wgId);
    expect(state.itemAssignments['item-c']).toBe(wgId);
  });

  it('unassigns a single item row', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignItemRows(['item-1', 'item-2'], wgId);
    store.unassignItemRow('item-1');

    const state = useSchemeBuilderStore.getState();
    expect(state.itemAssignments['item-1']).toBeUndefined();
    expect(state.itemAssignments['item-2']).toBe(wgId);
  });

  it('deletes work group and removes its assignments', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignItemRows(['item-1', 'item-2'], wgId);
    store.deleteWorkGroup(wgId);

    const state = useSchemeBuilderStore.getState();
    expect(state.workGroups).toHaveLength(0);
    expect(state.itemAssignments['item-1']).toBeUndefined();
    expect(state.itemAssignments['item-2']).toBeUndefined();
  });

  it('clears local draft completely', () => {
    const store = useSchemeBuilderStore.getState();
    store.createWorkGroup('south', 'קבוצה 1');
    store.setSelectedArea('south');

    let state = useSchemeBuilderStore.getState();
    expect(state.workGroups).toHaveLength(1);
    expect(state.selectedAreaName).toBe('south');

    state.clearLocalDraft();

    state = useSchemeBuilderStore.getState();
    expect(state.workGroups).toHaveLength(0);
    expect(state.itemAssignments).toEqual({});
    expect(state.selectedAreaName).toBeNull();
  });

  it('renameWorkGroup updates name correctly', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'ישן');
    store.renameWorkGroup(wgId, 'חדש');
    expect(useSchemeBuilderStore.getState().getWorkGroup(wgId)!.name).toBe('חדש');
  });

  it('isItemAssigned returns correct status', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignItemRows(['item-1'], wgId);

    expect(useSchemeBuilderStore.getState().isItemAssigned('item-1')).toBe(true);
    expect(useSchemeBuilderStore.getState().isItemAssigned('item-2')).toBe(false);
  });

  it('getItemWorkGroupId returns correct group', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');
    store.assignItemRows(['item-1'], wgId);

    expect(useSchemeBuilderStore.getState().getItemWorkGroupId('item-1')).toBe(wgId);
    expect(useSchemeBuilderStore.getState().getItemWorkGroupId('item-2')).toBeUndefined();
  });
});

describe('getOrderSplitStatus', () => {
  it('returns unassigned when no items are assigned', () => {
    const status = getOrderSplitStatus('order-1', ['i1', 'i2', 'i3'], {});
    expect(status).toBe('unassigned');
  });

  it('returns assigned when all items in one group', () => {
    const status = getOrderSplitStatus('order-1', ['i1', 'i2'], { i1: 'wg-1', i2: 'wg-1' });
    expect(status).toBe('assigned');
  });

  it('returns split when items in multiple groups', () => {
    const status = getOrderSplitStatus('order-1', ['i1', 'i2', 'i3'], { i1: 'wg-1', i2: 'wg-2', i3: 'wg-2' });
    expect(status).toBe('split');
  });

  it('returns partial when some items assigned', () => {
    const status = getOrderSplitStatus('order-1', ['i1', 'i2', 'i3'], { i1: 'wg-1', i2: 'wg-1' });
    expect(status).toBe('partial');
  });

  it('handles empty itemIds array', () => {
    const status = getOrderSplitStatus('order-1', [], {});
    expect(status).toBe('unassigned');
  });
});

describe('work group totals', () => {
  beforeEach(() => {
    resetStore();
  });

  it('computes item count and quantity correctly', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');

    const orderItemMap: Record<string, SourceOrderItem[]> = {
      'order-1': [
        { id: 'i1', orderId: 'order-1', sku: 'A', description: null, category: null, quantity: 5, notes: null, zone: null, sourceRows: null, sourceFile: null },
        { id: 'i2', orderId: 'order-1', sku: 'B', description: null, category: null, quantity: 10, notes: null, zone: null, sourceRows: null, sourceFile: null },
      ],
      'order-2': [
        { id: 'i3', orderId: 'order-2', sku: 'C', description: null, category: null, quantity: 15, notes: null, zone: null, sourceRows: null, sourceFile: null },
      ],
    };

    store.assignItemRows(['i1', 'i3'], wgId);

    const state = useSchemeBuilderStore.getState();
    const totalQty = state.getWorkGroupTotalQuantity(wgId, orderItemMap);
    expect(totalQty).toBe(20);

    const orderIds = state.getWorkGroupOrderIds(wgId, orderItemMap);
    expect(orderIds.size).toBe(2);
    expect(orderIds.has('order-1')).toBe(true);
    expect(orderIds.has('order-2')).toBe(true);
  });

  it('returns zero for a group with no assignments', () => {
    const store = useSchemeBuilderStore.getState();
    const wgId = store.createWorkGroup('south', 'קבוצה 1');

    const state = useSchemeBuilderStore.getState();
    expect(state.getWorkGroupTotalQuantity(wgId, {})).toBe(0);
    expect(state.getWorkGroupOrderIds(wgId, {}).size).toBe(0);
  });
});
