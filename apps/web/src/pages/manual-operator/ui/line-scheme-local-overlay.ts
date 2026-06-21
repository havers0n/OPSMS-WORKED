import { create } from 'zustand';
import type { LocalAssignmentOverlay } from './line-scheme-types';
import { buildBucketKeyForStore } from './line-scheme-adapter';

interface LocalOverlayState {
  assignments: Map<string, LocalAssignmentOverlay>;
  assignOrder: (orderId: string, lineId: string, bucketName: string | null) => void;
  unassignOrder: (orderId: string) => void;
  clearAll: () => void;
  getAssignment: (orderId: string) => LocalAssignmentOverlay | undefined;
}

export const useLocalOverlayStore = create<LocalOverlayState>((set, get) => ({
  assignments: new Map(),

  assignOrder: (orderId: string, lineId: string, bucketName: string | null) => {
    const bucketKey = buildBucketKeyForStore(lineId, bucketName);
    set(state => {
      const next = new Map(state.assignments);
      next.set(orderId, {
        assignedLineId: lineId,
        assignedBucketKey: bucketKey,
        assignmentType: 'whole_order'
      });
      return { assignments: next };
    });
  },

  unassignOrder: (orderId: string) => {
    set(state => {
      const next = new Map(state.assignments);
      next.delete(orderId);
      return { assignments: next };
    });
  },

  clearAll: () => {
    set({ assignments: new Map() });
  },

  getAssignment: (orderId: string) => {
    return get().assignments.get(orderId);
  }
}));
