import { create } from 'zustand';
import type { WorkGroup, OrderSplitStatus, SourceOrderItem } from './scheme-types';

function generateId(): string {
  return `wg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface SchemeBuilderState {
  selectedAreaName: string | null;

  workGroups: WorkGroup[];
  itemAssignments: Record<string, string>;

  setSelectedArea: (areaName: string | null) => void;

  createWorkGroup: (areaName: string, name: string) => string;
  renameWorkGroup: (workGroupId: string, name: string) => void;
  deleteWorkGroup: (workGroupId: string) => void;

  assignItemRows: (itemRowIds: string[], workGroupId: string) => void;
  assignWholeOrder: (itemRowIds: string[], workGroupId: string) => void;
  unassignItemRow: (itemRowId: string) => void;
  unassignItemRows: (itemRowIds: string[]) => void;

  clearLocalDraft: () => void;

  getWorkGroup: (workGroupId: string) => WorkGroup | undefined;
  isItemAssigned: (itemRowId: string) => boolean;
  getItemWorkGroupId: (itemRowId: string) => string | undefined;
  getWorkGroupItemCount: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => number;
  getWorkGroupTotalQuantity: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => number;
  getWorkGroupOrderIds: (workGroupId: string, orderItemMap?: Record<string, SourceOrderItem[]>) => Set<string>;
}

export const useSchemeBuilderStore = create<SchemeBuilderState>((set, get) => ({
  selectedAreaName: null,

  workGroups: [],
  itemAssignments: {},

  setSelectedArea: (areaName: string | null) => {
    set({ selectedAreaName: areaName });
  },

  createWorkGroup: (areaName: string, name: string): string => {
    const id = generateId();
    const wg: WorkGroup = { id, areaName, name, createdAt: Date.now() };
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

  deleteWorkGroup: (workGroupId: string) => {
    set((state) => {
      const remaining = { ...state.itemAssignments };
      for (const [itemId, wgId] of Object.entries(state.itemAssignments)) {
        if (wgId === workGroupId) {
          delete remaining[itemId];
        }
      }
      return {
        workGroups: state.workGroups.filter((wg) => wg.id !== workGroupId),
        itemAssignments: remaining,
      };
    });
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
    set({ workGroups: [], itemAssignments: {}, selectedAreaName: null });
  },

  getWorkGroup: (workGroupId: string) => {
    return get().workGroups.find((wg) => wg.id === workGroupId);
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
