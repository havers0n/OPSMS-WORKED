import { describe, expect, it, beforeEach } from 'vitest';
import { useSchemeBuilderStore, getOrderSplitStatus } from './scheme-store';
import type { SourceOrderItem, ItemAllocation } from './scheme-types';

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAllocations: [],
    targetWorkGroupId: null,
  });
}

function makeItem(id: string, orderId: string, qty: number): SourceOrderItem {
  return { id, orderId, sku: 'SKU', description: null, category: null, quantity: qty, notes: null, zone: null, sourceRows: null, sourceFile: null };
}

describe('scheme-store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('planning lines', () => {
    it('creates a planning line and returns its id', () => {
      const store = useSchemeBuilderStore.getState();
      const id = store.createPlanningLine('south', 'קו ראשי');
      expect(id).toBeTruthy();
      expect(id.startsWith('pl_')).toBe(true);
      const pl = store.getPlanningLine(id);
      expect(pl).toBeTruthy();
      expect(pl!.name).toBe('קו ראשי');
      expect(pl!.areaName).toBe('south');
      expect(pl!.sortOrder).toBe(0);
    });

    it('increments sortOrder for subsequent planning lines', () => {
      const store = useSchemeBuilderStore.getState();
      const id1 = store.createPlanningLine('south', 'קו 1');
      const id2 = store.createPlanningLine('south', 'קו 2');
      expect(store.getPlanningLine(id1)!.sortOrder).toBe(0);
      expect(store.getPlanningLine(id2)!.sortOrder).toBe(1);
    });

    it('renames a planning line', () => {
      const store = useSchemeBuilderStore.getState();
      const id = store.createPlanningLine('south', 'ישן');
      store.renamePlanningLine(id, 'חדש');
      expect(store.getPlanningLine(id)!.name).toBe('חדש');
    });

    it('deletes a planning line if it has no work groups', () => {
      const store = useSchemeBuilderStore.getState();
      const id = store.createPlanningLine('south', 'קו 1');
      const result = store.deletePlanningLine(id);
      expect(result).toEqual({ ok: true });
      expect(store.getPlanningLine(id)).toBeUndefined();
    });

    it('blocks deleting a planning line that has work groups', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.deletePlanningLine(plId);
      expect(result).toEqual({ ok: false, reason: 'has_work_groups' });
      expect(store.getPlanningLine(plId)).toBeTruthy();
    });

    it('getPlanningLinesByArea returns only lines for that area', () => {
      const store = useSchemeBuilderStore.getState();
      store.createPlanningLine('south', 'דרום 1');
      store.createPlanningLine('south', 'דרום 2');
      store.createPlanningLine('north', 'צפון 1');
      expect(store.getPlanningLinesByArea('south')).toHaveLength(2);
      expect(store.getPlanningLinesByArea('north')).toHaveLength(1);
      expect(store.getPlanningLinesByArea('center')).toHaveLength(0);
    });
  });

  describe('work groups under planning lines', () => {
    it('creates a work group under a planning line', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      expect(wgId).toBeTruthy();
      expect(wgId.startsWith('wg_')).toBe(true);
      const wg = store.getWorkGroup(wgId);
      expect(wg).toBeTruthy();
      expect(wg!.name).toBe('קבוצה 1');
      expect(wg!.planningLineId).toBe(plId);
      expect(wg!.areaName).toBe('south');
    });

    it('getWorkGroupsByPlanningLine returns correct groups', () => {
      const store = useSchemeBuilderStore.getState();
      const plId1 = store.createPlanningLine('south', 'קו 1');
      const plId2 = store.createPlanningLine('south', 'קו 2');
      store.createWorkGroup(plId1, 'קבוצה 1');
      store.createWorkGroup(plId1, 'קבוצה 2');
      store.createWorkGroup(plId2, 'קבוצה 3');
      expect(store.getWorkGroupsByPlanningLine(plId1)).toHaveLength(2);
      expect(store.getWorkGroupsByPlanningLine(plId2)).toHaveLength(1);
    });
  });

  describe('delete guards', () => {
    it('blocks deleting a work group that has allocations', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'item-1', workGroupId: wgId, qty: 5, totalQty: 10 });
      const result = store.deleteWorkGroup(wgId);
      expect(result).toEqual({ ok: false, reason: 'has_assignments' });
      expect(store.getWorkGroup(wgId)).toBeTruthy();
    });

    it('deletes a work group without allocated items', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.deleteWorkGroup(wgId);
      expect(result).toEqual({ ok: true });
      expect(store.getWorkGroup(wgId)).toBeUndefined();
    });

    it('deletePlanningLine still works after work group with allocations is deleted', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'item-1', workGroupId: wgId, qty: 5, totalQty: 10 });
      expect(store.deletePlanningLine(plId)).toEqual({ ok: false, reason: 'has_work_groups' });
      store.removeAllocationsForItem('item-1');
      expect(store.deleteWorkGroup(wgId)).toEqual({ ok: true });
      expect(store.deletePlanningLine(plId)).toEqual({ ok: true });
    });
  });

  describe('allocateItemQty', () => {
    it('creates an allocation record with correct fields', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      expect(result).toEqual({ ok: true });
      const allocs = useSchemeBuilderStore.getState().itemAllocations;
      expect(allocs).toHaveLength(1);
      expect(allocs[0].itemRowId).toBe('i1');
      expect(allocs[0].workGroupId).toBe(wgId);
      expect(allocs[0].qty).toBe(4);
      expect(allocs[0].id).toBeTruthy();
      expect(allocs[0].createdAt).toBeGreaterThan(0);
    });

    it('rejects qty <= 0', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      expect(store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 0, totalQty: 10 })).toEqual({ ok: false, reason: 'invalid_qty' });
      expect(store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: -1, totalQty: 10 })).toEqual({ ok: false, reason: 'invalid_qty' });
    });

    it('rejects non-integer qty', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 2.5, totalQty: 10 });
      expect(result).toEqual({ ok: false, reason: 'invalid_qty' });
    });

    it('rejects qty exceeding remaining', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 7, totalQty: 10 });
      expect(result).toEqual({ ok: false, reason: 'exceeds_remaining' });
    });

    it('rejects allocation when fully allocated', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 10, totalQty: 10 });
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 1, totalQty: 10 });
      expect(result).toEqual({ ok: false, reason: 'fully_allocated' });
    });

    it('rejects allocation when totalQty is 0 or missing', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      expect(store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 5, totalQty: 0 })).toEqual({ ok: false, reason: 'missing_item_qty' });
    });

    it('allows allocation at exactly remaining qty', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 6, totalQty: 10 });
      expect(result).toEqual({ ok: true });
    });

    it('stores only the entered partial quantity', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 6, totalQty: 12 });

      expect(result).toEqual({ ok: true });
      expect(useSchemeBuilderStore.getState().itemAllocations).toEqual([
        expect.objectContaining({ itemRowId: 'i1', workGroupId: wgId, qty: 6 }),
      ]);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(6);
      expect(useSchemeBuilderStore.getState().getRemainingQty('i1', 12)).toBe(6);
    });
  });

  describe('allocateItemRows', () => {
    it('assigns a row to a newly created work group in local state', () => {
      const store = useSchemeBuilderStore.getState();
      const lineId = store.createPlanningLine('דרום', 'ראשי');
      const workGroupId = store.createWorkGroup(lineId, 'כללי');

      expect(store.allocateItemRows(['item-1'], workGroupId, {
        order: [{ ...makeItem('item-1', 'order', 10) }],
      })).toEqual({ ok: true });
      expect(useSchemeBuilderStore.getState().itemAllocations).toEqual([
        expect.objectContaining({ itemRowId: 'item-1', workGroupId, qty: 10 }),
      ]);
    });

    it('allocates full remaining qty for each row', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const orderItemMap = { 'order-1': [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)] };
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      const result = store.allocateItemRows(['i1', 'i2'], wgId, orderItemMap);
      expect(result).toEqual({ ok: true });
      const i1Assigned = useSchemeBuilderStore.getState().getAssignedQty('i1');
      const i2Assigned = useSchemeBuilderStore.getState().getAssignedQty('i2');
      expect(i1Assigned).toBe(10);
      expect(i2Assigned).toBe(5);
    });

    it('allocates only the provided rows and ignores duplicates', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const orderItemMap = {
        'order-1': [
          makeItem('i1', 'order-1', 1),
          makeItem('i2', 'order-1', 1),
          makeItem('i3', 'order-1', 1),
          makeItem('i4', 'order-1', 1),
          makeItem('i5', 'order-1', 1),
        ],
      };

      const result = store.allocateItemRows(['i2', 'i4', 'i2', 'i4'], wgId, orderItemMap);
      expect(result).toEqual({ ok: true });
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(0);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i2')).toBe(1);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i3')).toBe(0);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i4')).toBe(1);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i5')).toBe(0);
      expect(useSchemeBuilderStore.getState().getWorkGroupItemCount(wgId)).toBe(2);
    });
  });

  describe('allocateWholeOrder', () => {
    it('allocates remaining qty for all rows in the order only', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const orderItemMap = {
        'order-1': [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)],
        'order-2': [makeItem('i3', 'order-2', 20)],
      };
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      const result = store.allocateWholeOrder('order-1', wgId, orderItemMap);
      expect(result).toEqual({ ok: true });
      const i1Assigned = useSchemeBuilderStore.getState().getAssignedQty('i1');
      const i2Assigned = useSchemeBuilderStore.getState().getAssignedQty('i2');
      expect(i1Assigned).toBe(10);
      expect(i2Assigned).toBe(5);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i3')).toBe(0);
    });
  });

  describe('getAssignedQty', () => {
    it('sums allocations for a given item row', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId1 = store.createWorkGroup(plId, 'קבוצה 1');
      const wgId2 = store.createWorkGroup(plId, 'קבוצה 2');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId1, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId2, qty: 4, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(7);
    });

    it('returns 0 for item with no allocations', () => {
      expect(useSchemeBuilderStore.getState().getAssignedQty('nonexistent')).toBe(0);
    });
  });

  describe('getRemainingQty', () => {
    it('computes remaining correctly', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getRemainingQty('i1', 10)).toBe(6);
    });

    it('returns 0 when fully allocated', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 10, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getRemainingQty('i1', 10)).toBe(0);
    });
  });

  describe('getItemAllocations', () => {
    it('returns allocations for a specific item row', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId, qty: 5, totalQty: 10 });
      const allocs = useSchemeBuilderStore.getState().getItemAllocations('i1');
      expect(allocs).toHaveLength(1);
      expect(allocs[0].itemRowId).toBe('i1');
    });

    it('returns empty array for item with no allocations', () => {
      expect(useSchemeBuilderStore.getState().getItemAllocations('nonexistent')).toEqual([]);
    });
  });

  describe('getAllocationsForWorkGroup', () => {
    it('returns allocations for a specific work group', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId1 = store.createWorkGroup(plId, 'קבוצה 1');
      const wgId2 = store.createWorkGroup(plId, 'קבוצה 2');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId1, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId2, qty: 5, totalQty: 10 });
      const allocs = useSchemeBuilderStore.getState().getAllocationsForWorkGroup(wgId1);
      expect(allocs).toHaveLength(1);
      expect(allocs[0].itemRowId).toBe('i1');
    });
  });

  describe('removeAllocation', () => {
    it('removes a specific allocation and restores remaining qty', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 3, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(7);
      const allocs = useSchemeBuilderStore.getState().getItemAllocations('i1');
      store.removeAllocation(allocs[0].id);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(3);
      expect(useSchemeBuilderStore.getState().getRemainingQty('i1', 10)).toBe(7);
    });
  });

  describe('removeAllocationsForItem', () => {
    it('removes all allocations for a given item row', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId1 = store.createWorkGroup(plId, 'קבוצה 1');
      const wgId2 = store.createWorkGroup(plId, 'קבוצה 2');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId1, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId2, qty: 4, totalQty: 10 });
      store.removeAllocationsForItem('i1');
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(0);
      expect(useSchemeBuilderStore.getState().getRemainingQty('i1', 10)).toBe(10);
    });
  });

  describe('removeAllocationsForItems', () => {
    it('removes allocations for multiple item rows', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId, qty: 5, totalQty: 10 });
      store.removeAllocationsForItems(['i1', 'i2']);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i1')).toBe(0);
      expect(useSchemeBuilderStore.getState().getAssignedQty('i2')).toBe(0);
    });
  });

  describe('work group totals', () => {
    it('item count is unique itemRowIds allocated to the group', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId, qty: 5, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getWorkGroupItemCount(wgId)).toBe(2);
    });

    it('total quantity uses allocation.qty not full item qty', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId, qty: 8, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().getWorkGroupTotalQuantity(wgId)).toBe(12);
    });

    it('total qty returns 0 for empty group', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      expect(useSchemeBuilderStore.getState().getWorkGroupTotalQuantity(wgId)).toBe(0);
    });

    it('order ids resolved from orderItemMap', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const orderItemMap = {
        'order-1': [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)],
        'order-2': [makeItem('i3', 'order-2', 20)],
      };
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 4, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i3', workGroupId: wgId, qty: 10, totalQty: 20 });
      const orderIds = useSchemeBuilderStore.getState().getWorkGroupOrderIds(wgId, orderItemMap);
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('order-1')).toBe(true);
      expect(orderIds.has('order-2')).toBe(true);
    });
  });

  describe('isItemAssigned', () => {
    it('returns true if item has any allocation', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId, qty: 1, totalQty: 10 });
      expect(useSchemeBuilderStore.getState().isItemAssigned('i1')).toBe(true);
    });

    it('returns false if item has no allocation', () => {
      expect(useSchemeBuilderStore.getState().isItemAssigned('i1')).toBe(false);
    });
  });

  describe('clearLocalDraft', () => {
    it('clears everything including allocations', () => {
      const store = useSchemeBuilderStore.getState();
      store.createPlanningLine('south', 'קו 1');
      const plId = store.createPlanningLine('south', 'קו 2');
      store.createWorkGroup(plId, 'קבוצה 1');
      store.setSelectedArea('south');
      store.setTargetWorkGroup('wg-1');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: 'wg-1', qty: 5, totalQty: 10 });
      let state = useSchemeBuilderStore.getState();
      expect(state.planningLines).toHaveLength(2);
      expect(state.workGroups).toHaveLength(1);
      expect(state.itemAllocations).toHaveLength(1);
      expect(state.selectedAreaName).toBe('south');
      expect(state.targetWorkGroupId).toBe('wg-1');
      state.clearLocalDraft();
      state = useSchemeBuilderStore.getState();
      expect(state.planningLines).toHaveLength(0);
      expect(state.workGroups).toHaveLength(0);
      expect(state.itemAllocations).toEqual([]);
      expect(state.selectedAreaName).toBeNull();
      expect(state.targetWorkGroupId).toBeNull();
    });
  });

  describe('duplicate orderNumber safety', () => {
    it('still works with duplicate order numbers', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId1 = store.createWorkGroup(plId, 'קבוצה 1');
      const wgId2 = store.createWorkGroup(plId, 'קבוצה 2');
      store.allocateItemQty({ itemRowId: 'i1', workGroupId: wgId1, qty: 5, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i2', workGroupId: wgId1, qty: 3, totalQty: 10 });
      store.allocateItemQty({ itemRowId: 'i3', workGroupId: wgId2, qty: 7, totalQty: 10 });
      const state = useSchemeBuilderStore.getState();
      expect(state.getWorkGroupItemCount(wgId1)).toBe(2);
      expect(state.getWorkGroupItemCount(wgId2)).toBe(1);
    });
  });

  describe('target work group', () => {
    it('setTargetWorkGroup sets the target work group id', () => {
      useSchemeBuilderStore.getState().setTargetWorkGroup('wg-1');
      expect(useSchemeBuilderStore.getState().targetWorkGroupId).toBe('wg-1');
    });

    it('setTargetWorkGroup with null clears the target', () => {
      useSchemeBuilderStore.getState().setTargetWorkGroup('wg-1');
      useSchemeBuilderStore.getState().setTargetWorkGroup(null);
      expect(useSchemeBuilderStore.getState().targetWorkGroupId).toBeNull();
    });

    it('setSelectedArea clears the target work group', () => {
      useSchemeBuilderStore.getState().setTargetWorkGroup('wg-1');
      useSchemeBuilderStore.getState().setSelectedArea('north');
      expect(useSchemeBuilderStore.getState().targetWorkGroupId).toBeNull();
    });

    it('deleting the target work group clears targetWorkGroupId', () => {
      const plId = useSchemeBuilderStore.getState().createPlanningLine('south', 'קו 1');
      const wgId = useSchemeBuilderStore.getState().createWorkGroup(plId, 'קבוצה 1');
      useSchemeBuilderStore.getState().setTargetWorkGroup(wgId);
      useSchemeBuilderStore.getState().deleteWorkGroup(wgId);
      expect(useSchemeBuilderStore.getState().targetWorkGroupId).toBeNull();
    });

    it('clearLocalDraft clears target work group', () => {
      useSchemeBuilderStore.getState().setTargetWorkGroup('wg-1');
      useSchemeBuilderStore.getState().clearLocalDraft();
      expect(useSchemeBuilderStore.getState().targetWorkGroupId).toBeNull();
    });
  });
});

describe('getOrderSplitStatus', () => {
  it('returns unassigned when all items have no allocations', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const status = getOrderSplitStatus('order-1', items, []);
    expect(status).toBe('unassigned');
  });

  it('returns assigned when all items are fully allocated to one group', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations: ItemAllocation[] = [
      { id: 'a1', itemRowId: 'i1', workGroupId: 'wg-1', qty: 10, createdAt: 1 },
      { id: 'a2', itemRowId: 'i2', workGroupId: 'wg-1', qty: 5, createdAt: 1 },
    ];
    const status = getOrderSplitStatus('order-1', items, allocations);
    expect(status).toBe('assigned');
  });

  it('returns split when same item row allocated to multiple groups', () => {
    const items = [makeItem('i1', 'order-1', 10)];
    const allocations: ItemAllocation[] = [
      { id: 'a1', itemRowId: 'i1', workGroupId: 'wg-1', qty: 4, createdAt: 1 },
      { id: 'a2', itemRowId: 'i1', workGroupId: 'wg-2', qty: 6, createdAt: 1 },
    ];
    const status = getOrderSplitStatus('order-1', items, allocations);
    expect(status).toBe('split');
  });

  it('returns split when different items in multiple groups', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations: ItemAllocation[] = [
      { id: 'a1', itemRowId: 'i1', workGroupId: 'wg-1', qty: 10, createdAt: 1 },
      { id: 'a2', itemRowId: 'i2', workGroupId: 'wg-2', qty: 5, createdAt: 1 },
    ];
    const status = getOrderSplitStatus('order-1', items, allocations);
    expect(status).toBe('split');
  });

  it('returns partial when some items have remaining qty', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations: ItemAllocation[] = [
      { id: 'a1', itemRowId: 'i1', workGroupId: 'wg-1', qty: 4, createdAt: 1 },
    ];
    const status = getOrderSplitStatus('order-1', items, allocations);
    expect(status).toBe('partial');
  });

  it('handles empty items array', () => {
    const status = getOrderSplitStatus('order-1', [], []);
    expect(status).toBe('unassigned');
  });

  it('returns assigned when partial allocation sums to full qty', () => {
    const items = [makeItem('i1', 'order-1', 10)];
    const allocations: ItemAllocation[] = [
      { id: 'a1', itemRowId: 'i1', workGroupId: 'wg-1', qty: 4, createdAt: 1 },
      { id: 'a2', itemRowId: 'i1', workGroupId: 'wg-1', qty: 6, createdAt: 1 },
    ];
    const status = getOrderSplitStatus('order-1', items, allocations);
    expect(status).toBe('assigned');
  });
});
