import { useQuery } from '@tanstack/react-query';
import { cellSlotStorageQueryOptions } from './queries';

/**
 * Fetches the cell storage snapshot for all cells at a given rack section slot.
 *
 * Returns the standard TanStack Query result with:
 *   data  — CellStorageSnapshotRow[] (empty = slot is empty or layout unpublished)
 *   isPending / isError — for loading and error states
 */
export function useCellSlotStorage(sectionId: string | null, slotNo: number | null) {
  return useQuery(cellSlotStorageQueryOptions(sectionId, slotNo));
}
