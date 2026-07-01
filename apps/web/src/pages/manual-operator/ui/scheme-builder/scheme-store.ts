import { create } from 'zustand';
import type { PlanningLine, WorkGroup, OrderSplitStatus, SourceOrderItem, DeleteResult, AllocateResult, ItemAllocation } from './scheme-types';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface SchemeBuilderState {
  selectedAreaName: string | null;
  targetWorkGroupId: string | null;

  planningLines: PlanningLine[];
  workGroups: WorkGroup[];
  itemAllocations: ItemAllocation[];

  setSelectedArea: (areaName: string | null) => void;
  setTargetWorkGroup: (workGroupId: string | null) => void;

  createPlanningLine: (areaName: string, name: string) => string;
  renamePlanningLine: (planningLineId: string, name: string) => void;
  deletePlanningLine: (planningLineId: string) => DeleteResult;

  createWorkGroup: (planningLineId: string, name: string) => string;
  renameWorkGroup: (workGroupId: string, name: string) => void;
  deleteWorkGroup: (workGroupId: string) => DeleteResult;

  allocateItemQty: (input: { itemRowId: string; workGroupId: string; qty: number; totalQty: number }) => AllocateResult;
  allocateItemRows: (itemRowIds: string[], workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>) => AllocateResult;
  allocateWholeOrder: (orderId: string, workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>) => AllocateResult;
  removeAllocation: (allocationId: string) => void;
  removeAllocationsForItem: (itemRowId: string) => void;
  removeAllocationsForItems: (itemRowIds: string[]) => void;

  clearLocalDraft: () => void;
  hydrateFromDraft: (input: {
    planningLines: PlanningLine[];
    workGroups: WorkGroup[];
    itemAllocations: ItemAllocation[];
  }) => void;

  getPlanningLine: (planningLineId: string) => PlanningLine | undefined;
  getPlanningLinesByArea: (areaName: string) => PlanningLine[];
  getWorkGroup: (workGroupId: string) => WorkGroup | undefined;
  getWorkGroupsByPlanningLine: (planningLineId: string) => WorkGroup[];
  isItemAssigned: (itemRowId: string) => boolean;
  getAssignedQty: (itemRowId: string) => number;
  getRemainingQty: (itemRowId: string, totalQty: number) => number;
  getItemAllocations: (itemRowId: string) => ItemAllocation[];
  getAllocationsForWorkGroup: (workGroupId: string) => ItemAllocation[];
  getWorkGroupItemCount: (workGroupId: string) => number;
  getWorkGroupTotalQuantity: (workGroupId: string) => number;
  getWorkGroupOrderIds: (workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>) => Set<string>;
}

export const useSchemeBuilderStore = create<SchemeBuilderState>((set, get) => ({
  selectedAreaName: null,
  targetWorkGroupId: null,

  planningLines: [],
  workGroups: [],
  itemAllocations: [],

  setSelectedArea: (areaName: string | null) => {
    set({ selectedAreaName: areaName, targetWorkGroupId: null });
  },

  setTargetWorkGroup: (workGroupId: string | null) => {
    set({ targetWorkGroupId: workGroupId });
  },

  createPlanningLine: (areaName: string, name: string): string => {
    const id = generateId('pl');
    const pl: PlanningLine = { id, areaName, name, sortOrder: get().planningLines.length, createdAt: Date.now() };
    set((state) => ({ planningLines: [...state.planningLines, pl] }));
    return id;
  },

  renamePlanningLine: (planningLineId: string, name: string) => {
    set((state) => ({
      planningLines: state.planningLines.map((pl) =>
        pl.id === planningLineId ? { ...pl, name } : pl,
      ),
    }));
  },

  deletePlanningLine: (planningLineId: string): DeleteResult => {
    const state = get();
    const hasGroups = state.workGroups.some((wg) => wg.planningLineId === planningLineId);
    if (hasGroups) {
      return { ok: false, reason: 'has_work_groups' };
    }
    set((s) => ({
      planningLines: s.planningLines.filter((pl) => pl.id !== planningLineId),
    }));
    return { ok: true };
  },

  createWorkGroup: (planningLineId: string, name: string): string => {
    const planningLine = get().planningLines.find((pl) => pl.id === planningLineId);
    const areaName = planningLine?.areaName ?? '';
    const id = generateId('wg');
    const wg: WorkGroup = { id, planningLineId, areaName, name, createdAt: Date.now() };
    set((state) => ({ workGroups: [...state.workGroups, wg] }));
    return id;
  },

  renameWorkGroup: (workGroupId: string, name: string) => {
    set((state) => ({
      workGroups: state.workGroups.map((wg) =>
        wg.id === workGroupId ? { ...wg, name } : wg,
      ),
    }));
  },

  deleteWorkGroup: (workGroupId: string): DeleteResult => {
    const state = get();
    if (workGroupId === state.targetWorkGroupId) {
      set({ targetWorkGroupId: null });
    }
    const hasAllocations = state.itemAllocations.some((a) => a.workGroupId === workGroupId);
    if (hasAllocations) {
      return { ok: false, reason: 'has_assignments' };
    }
    set((s) => ({
      workGroups: s.workGroups.filter((wg) => wg.id !== workGroupId),
    }));
    return { ok: true };
  },

  allocateItemQty: (input: { itemRowId: string; workGroupId: string; qty: number; totalQty: number }): AllocateResult => {
    const { itemRowId, workGroupId, qty, totalQty } = input;
    if (!Number.isInteger(qty) || qty <= 0) {
      return { ok: false, reason: 'invalid_qty' };
    }
    if (totalQty <= 0) {
      return { ok: false, reason: 'missing_item_qty' };
    }
    const state = get();
    const currentAssigned = state.itemAllocations
      .filter((a) => a.itemRowId === itemRowId)
      .reduce((sum, a) => sum + a.qty, 0);
    const remaining = totalQty - currentAssigned;
    if (remaining <= 0) {
      return { ok: false, reason: 'fully_allocated' };
    }
    if (qty > remaining) {
      return { ok: false, reason: 'exceeds_remaining' };
    }
    const allocation: ItemAllocation = {
      id: generateId('alloc'),
      itemRowId,
      workGroupId,
      qty,
      createdAt: Date.now(),
    };
    set((state) => ({ itemAllocations: [...state.itemAllocations, allocation] }));
    return { ok: true };
  },

  allocateItemRows: (itemRowIds: string[], workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>): AllocateResult => {
    const rowById = new Map<string, SourceOrderItem>();
    for (const items of Object.values(orderItemMap)) {
      for (const item of items) {
        if (!rowById.has(item.id)) {
          rowById.set(item.id, item);
        }
      }
    }

    let hasError: AllocateResult | null = null;
    const uniqueItemRowIds = [...new Set(itemRowIds)];
    for (const itemRowId of uniqueItemRowIds) {
      const row = rowById.get(itemRowId);
      const totalQty = row?.quantity ?? 0;
      if (totalQty <= 0) {
        hasError = { ok: false, reason: 'missing_item_qty' };
        continue;
      }
      const currentAssigned = get().itemAllocations
        .filter((a) => a.itemRowId === itemRowId)
        .reduce((sum, a) => sum + a.qty, 0);
      const remaining = totalQty - currentAssigned;
      if (remaining <= 0) continue;
      const allocation: ItemAllocation = {
        id: generateId('alloc'),
        itemRowId,
        workGroupId,
        qty: remaining,
        createdAt: Date.now(),
      };
      set((s) => ({ itemAllocations: [...s.itemAllocations, allocation] }));
    }
    return hasError ?? { ok: true };
  },

  allocateWholeOrder: (orderId: string, workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>): AllocateResult => {
    const items = orderItemMap[orderId];
    if (!items || items.length === 0) {
      return { ok: false, reason: 'missing_item_qty' };
    }
    const itemRowIds = items.map((i) => i.id);
    return get().allocateItemRows(itemRowIds, workGroupId, orderItemMap);
  },

  removeAllocation: (allocationId: string) => {
    set((state) => ({
      itemAllocations: state.itemAllocations.filter((a) => a.id !== allocationId),
    }));
  },

  removeAllocationsForItem: (itemRowId: string) => {
    set((state) => ({
      itemAllocations: state.itemAllocations.filter((a) => a.itemRowId !== itemRowId),
    }));
  },

  removeAllocationsForItems: (itemRowIds: string[]) => {
    const removeSet = new Set(itemRowIds);
    set((state) => ({
      itemAllocations: state.itemAllocations.filter((a) => !removeSet.has(a.itemRowId)),
    }));
  },

  clearLocalDraft: () => {
    set({ planningLines: [], workGroups: [], itemAllocations: [], selectedAreaName: null, targetWorkGroupId: null });
  },

  hydrateFromDraft: (input: {
    planningLines: PlanningLine[];
    workGroups: WorkGroup[];
    itemAllocations: ItemAllocation[];
  }) => {
    set({
      planningLines: input.planningLines,
      workGroups: input.workGroups,
      itemAllocations: input.itemAllocations,
      selectedAreaName: null,
      targetWorkGroupId: null,
    });
  },

  getPlanningLine: (planningLineId: string) => {
    return get().planningLines.find((pl) => pl.id === planningLineId);
  },

  getPlanningLinesByArea: (areaName: string) => {
    return get().planningLines.filter((pl) => pl.areaName === areaName);
  },

  getWorkGroup: (workGroupId: string) => {
    return get().workGroups.find((wg) => wg.id === workGroupId);
  },

  getWorkGroupsByPlanningLine: (planningLineId: string) => {
    return get().workGroups.filter((wg) => wg.planningLineId === planningLineId);
  },

  isItemAssigned: (itemRowId: string) => {
    return get().itemAllocations.some((a) => a.itemRowId === itemRowId);
  },

  getAssignedQty: (itemRowId: string) => {
    return get().itemAllocations
      .filter((a) => a.itemRowId === itemRowId)
      .reduce((sum, a) => sum + a.qty, 0);
  },

  getRemainingQty: (itemRowId: string, totalQty: number) => {
    return totalQty - get().getAssignedQty(itemRowId);
  },

  getItemAllocations: (itemRowId: string) => {
    return get().itemAllocations.filter((a) => a.itemRowId === itemRowId);
  },

  getAllocationsForWorkGroup: (workGroupId: string) => {
    return get().itemAllocations.filter((a) => a.workGroupId === workGroupId);
  },

  getWorkGroupItemCount: (workGroupId: string) => {
    const uniqueRows = new Set(
      get().itemAllocations
        .filter((a) => a.workGroupId === workGroupId)
        .map((a) => a.itemRowId),
    );
    return uniqueRows.size;
  },

  getWorkGroupTotalQuantity: (workGroupId: string) => {
    return get().itemAllocations
      .filter((a) => a.workGroupId === workGroupId)
      .reduce((sum, a) => sum + a.qty, 0);
  },

  getWorkGroupOrderIds: (workGroupId: string, orderItemMap: Record<string, SourceOrderItem[]>) => {
    const allocatedItemRowIds = new Set(
      get().itemAllocations
        .filter((a) => a.workGroupId === workGroupId)
        .map((a) => a.itemRowId),
    );
    const orderIds = new Set<string>();
    for (const [orderId, items] of Object.entries(orderItemMap)) {
      for (const item of items) {
        if (allocatedItemRowIds.has(item.id)) {
          orderIds.add(orderId);
          break;
        }
      }
    }
    return orderIds;
  },
}));

export function getOrderSplitStatus(
  orderId: string,
  items: SourceOrderItem[],
  itemAllocations: ItemAllocation[],
): OrderSplitStatus {
  const itemIds = items.map((i) => i.id);
  if (itemIds.length === 0) return 'unassigned';

  let unassignedCount = 0;
  let fullyAssignedCount = 0;
  const allGroups = new Set<string>();
  let hasItemSplit = false;

  for (const item of items) {
    const allocs = itemAllocations.filter((a) => a.itemRowId === item.id);
    const assignedQty = allocs.reduce((s, a) => s + a.qty, 0);
    const remainingQty = item.quantity - assignedQty;

    const wgIds = new Set(allocs.map((a) => a.workGroupId));
    if (wgIds.size > 1) hasItemSplit = true;
    wgIds.forEach((g) => allGroups.add(g));

    if (assignedQty === 0) {
      unassignedCount++;
    } else if (remainingQty > 0) {
      // partially allocated
    } else {
      fullyAssignedCount++;
    }
  }

  if (unassignedCount === itemIds.length) return 'unassigned';
  if (hasItemSplit) return 'split';
  if (fullyAssignedCount === itemIds.length && allGroups.size > 1) return 'split';
  if (fullyAssignedCount === itemIds.length) return 'assigned';
  return 'partial';
}
