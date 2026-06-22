import { create } from 'zustand';
import type { PlanningLine, WorkGroup, OrderSplitStatus, SourceOrderItem, DeleteResult } from './scheme-types';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface SchemeBuilderState {
  selectedAreaName: string | null;
  targetWorkGroupId: string | null;

  planningLines: PlanningLine[];
  workGroups: WorkGroup[];
  itemAssignments: Record<string, string>;

  setSelectedArea: (areaName: string | null) => void;
  setTargetWorkGroup: (workGroupId: string | null) => void;

  createPlanningLine: (areaName: string, name: string) => string;
  renamePlanningLine: (planningLineId: string, name: string) => void;
  deletePlanningLine: (planningLineId: string) => DeleteResult;

  createWorkGroup: (planningLineId: string, name: string) => string;
  renameWorkGroup: (workGroupId: string, name: string) => void;
  deleteWorkGroup: (workGroupId: string) => DeleteResult;

  assignItemRows: (itemRowIds: string[], workGroupId: string) => void;
  assignWholeOrder: (itemRowIds: string[], workGroupId: string) => void;
  unassignItemRow: (itemRowId: string) => void;
  unassignItemRows: (itemRowIds: string[]) => void;

  clearLocalDraft: () => void;

  getPlanningLine: (planningLineId: string) => PlanningLine | undefined;
  getPlanningLinesByArea: (areaName: string) => PlanningLine[];
  getWorkGroup: (workGroupId: string) => WorkGroup | undefined;
  getWorkGroupsByPlanningLine: (planningLineId: string) => WorkGroup[];
  isItemAssigned: (itemRowId: string) => boolean;
  getItemWorkGroupId: (itemRowId: string) => string | undefined;
  getWorkGroupItemCount: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => number;
  getWorkGroupTotalQuantity: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => number;
  getWorkGroupOrderIds: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => Set<string>;
}

export const useSchemeBuilderStore = create<SchemeBuilderState>((set, get) => ({
  selectedAreaName: null,
  targetWorkGroupId: null,

  planningLines: [],
  workGroups: [],
  itemAssignments: {},

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
    const hasAssignments = Object.values(state.itemAssignments).some((wgId) => wgId === workGroupId);
    if (hasAssignments) {
      return { ok: false, reason: 'has_assignments' };
    }
    set((s) => ({
      workGroups: s.workGroups.filter((wg) => wg.id !== workGroupId),
    }));
    return { ok: true };
  },

  assignItemRows: (itemRowIds: string[], workGroupId: string) => {
    set((state) => {
      const next = { ...state.itemAssignments };
      for (const id of itemRowIds) {
        next[id] = workGroupId;
      }
      return { itemAssignments: next };
    });
  },

  assignWholeOrder: (itemRowIds: string[], workGroupId: string) => {
    set((state) => {
      const next = { ...state.itemAssignments };
      for (const id of itemRowIds) {
        next[id] = workGroupId;
      }
      return { itemAssignments: next };
    });
  },

  unassignItemRow: (itemRowId: string) => {
    set((state) => {
      const next = { ...state.itemAssignments };
      delete next[itemRowId];
      return { itemAssignments: next };
    });
  },

  unassignItemRows: (itemRowIds: string[]) => {
    set((state) => {
      const next = { ...state.itemAssignments };
      for (const id of itemRowIds) {
        delete next[id];
      }
      return { itemAssignments: next };
    });
  },

  clearLocalDraft: () => {
    set({ planningLines: [], workGroups: [], itemAssignments: {}, selectedAreaName: null, targetWorkGroupId: null });
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
    return itemRowId in get().itemAssignments;
  },

  getItemWorkGroupId: (itemRowId: string) => {
    return get().itemAssignments[itemRowId];
  },

  getWorkGroupItemCount: (workGroupId: string) => {
    const state = get();
    return Object.entries(state.itemAssignments).filter(([, wgId]) => wgId === workGroupId).length;
  },

  getWorkGroupTotalQuantity: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => {
    const state = get();
    const assignedIds = Object.entries(state.itemAssignments)
      .filter(([, wgId]) => wgId === workGroupId)
      .map(([itemId]) => itemId);
    if (!orderItemMap) return assignedIds.length;
    let total = 0;
    for (const items of Object.values(orderItemMap)) {
      for (const item of items) {
        if (assignedIds.includes(item.id)) {
          total += item.quantity;
        }
      }
    }
    return total;
  },

  getWorkGroupOrderIds: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => {
    const state = get();
    const assignedIds = Object.entries(state.itemAssignments)
      .filter(([, wgId]) => wgId === workGroupId)
      .map(([itemId]) => itemId);
    const orderIds = new Set<string>();
    if (!orderItemMap) {
      return orderIds;
    }
    for (const [orderId, items] of Object.entries(orderItemMap)) {
      for (const item of items) {
        if (assignedIds.includes(item.id)) {
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
  itemIds: string[],
  itemAssignments: Record<string, string>,
): OrderSplitStatus {
  const assignedGroups = new Set<string>();
  let assignedCount = 0;
  for (const itemId of itemIds) {
    const wgId = itemAssignments[itemId];
    if (wgId) {
      assignedGroups.add(wgId);
      assignedCount++;
    }
  }
  if (assignedCount === 0) return 'unassigned';
  if (assignedCount === itemIds.length && assignedGroups.size <= 1) return 'assigned';
  if (assignedGroups.size > 1) return 'split';
  return 'partial';
}

