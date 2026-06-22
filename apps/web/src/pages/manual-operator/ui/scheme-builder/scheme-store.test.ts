import { describe, expect, it, beforeEach } from 'vitest';
import { useSchemeBuilderStore, getOrderSplitStatus } from './scheme-store';
import type { SourceOrderItem } from './scheme-types';

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAssignments: {},
  });
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
    it('blocks deleting a work group that has assigned items', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignItemRows(['item-1'], wgId);
      const result = store.deleteWorkGroup(wgId);
      expect(result).toEqual({ ok: false, reason: 'has_assignments' });
      expect(store.getWorkGroup(wgId)).toBeTruthy();
    });

    it('deletes a work group without assigned items', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const result = store.deleteWorkGroup(wgId);
      expect(result).toEqual({ ok: true });
      expect(store.getWorkGroup(wgId)).toBeUndefined();
    });

    it('deletePlanningLine still works after work group with assignments is deleted', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignItemRows(['item-1'], wgId);
      expect(store.deletePlanningLine(plId)).toEqual({ ok: false, reason: 'has_work_groups' });
      store.unassignItemRow('item-1');
      expect(store.deleteWorkGroup(wgId)).toEqual({ ok: true });
      expect(store.deletePlanningLine(plId)).toEqual({ ok: true });
    });
  });

  describe('assignment (remains by itemRowId)', () => {
    it('assigns items by itemRowId, not orderId', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignItemRows(['item-1', 'item-2'], wgId);
      const state = useSchemeBuilderStore.getState();
      expect(state.itemAssignments['item-1']).toBe(wgId);
      expect(state.itemAssignments['item-2']).toBe(wgId);
      expect(state.itemAssignments['item-3']).toBeUndefined();
    });

    it('assigns item rows even if work group id is unknown (store does not validate wg existence)', () => {
      const store = useSchemeBuilderStore.getState();
      store.assignItemRows(['item-1'], 'nonexistent');
      expect(useSchemeBuilderStore.getState().itemAssignments['item-1']).toBe('nonexistent');
    });

    it('whole-order shortcut assigns all given item rows', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignWholeOrder(['item-a', 'item-b'], wgId);
      expect(useSchemeBuilderStore.getState().itemAssignments['item-a']).toBe(wgId);
      expect(useSchemeBuilderStore.getState().itemAssignments['item-b']).toBe(wgId);
    });

    it('unassigns a single item row', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignItemRows(['item-1', 'item-2'], wgId);
      store.unassignItemRow('item-1');
      const state = useSchemeBuilderStore.getState();
      expect(state.itemAssignments['item-1']).toBeUndefined();
      expect(state.itemAssignments['item-2']).toBe(wgId);
    });

    it('getItemWorkGroupId returns correct group', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      store.assignItemRows(['item-1'], wgId);
      expect(useSchemeBuilderStore.getState().getItemWorkGroupId('item-1')).toBe(wgId);
      expect(useSchemeBuilderStore.getState().getItemWorkGroupId('item-2')).toBeUndefined();
    });
  });

  describe('work group totals still work', () => {
    it('computes item count and quantity correctly', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
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
      expect(state.getWorkGroupTotalQuantity(wgId, orderItemMap)).toBe(20);
      const orderIds = state.getWorkGroupOrderIds(wgId, orderItemMap);
      expect(orderIds.size).toBe(2);
      expect(orderIds.has('order-1')).toBe(true);
      expect(orderIds.has('order-2')).toBe(true);
    });

    it('returns zero for a group with no assignments', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId = store.createWorkGroup(plId, 'קבוצה 1');
      const state = useSchemeBuilderStore.getState();
      expect(state.getWorkGroupTotalQuantity(wgId, {})).toBe(0);
      expect(state.getWorkGroupOrderIds(wgId, {}).size).toBe(0);
    });
  });

  describe('clearLocalDraft', () => {
    it('clears everything including planning lines', () => {
      const store = useSchemeBuilderStore.getState();
      store.createPlanningLine('south', 'קו 1');
      const plId = store.createPlanningLine('south', 'קו 2');
      store.createWorkGroup(plId, 'קבוצה 1');
      store.setSelectedArea('south');
      let state = useSchemeBuilderStore.getState();
      expect(state.planningLines).toHaveLength(2);
      expect(state.workGroups).toHaveLength(1);
      expect(state.selectedAreaName).toBe('south');
      state.clearLocalDraft();
      state = useSchemeBuilderStore.getState();
      expect(state.planningLines).toHaveLength(0);
      expect(state.workGroups).toHaveLength(0);
      expect(state.itemAssignments).toEqual({});
      expect(state.selectedAreaName).toBeNull();
    });
  });

  describe('duplicate orderNumber safety', () => {
    it('still work with duplicate order numbers (backend may return duplicates)', () => {
      const store = useSchemeBuilderStore.getState();
      const plId = store.createPlanningLine('south', 'קו 1');
      const wgId1 = store.createWorkGroup(plId, 'קבוצה 1');
      const wgId2 = store.createWorkGroup(plId, 'קבוצה 2');
      store.assignItemRows(['i1', 'i2'], wgId1);
      store.assignItemRows(['i3'], wgId2);
      const state = useSchemeBuilderStore.getState();
      expect(state.getWorkGroupItemCount(wgId1)).toBe(2);
      expect(state.getWorkGroupItemCount(wgId2)).toBe(1);
    });
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
