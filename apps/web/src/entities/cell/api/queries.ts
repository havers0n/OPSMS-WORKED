import type { CellStorageSnapshotRow } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const cellKeys = {
  all: ['cell'] as const,
  /**
   * Storage snapshot for all cells in a rack section at a given slot number.
   * sectionId = rack_section UUID (persists from draft to published layout).
   * slotNo    = 1-based slot number matching cells.slot_no in DB.
   */
  slotStorage: (sectionId: string | null, slotNo: number | null) =>
    [...cellKeys.all, 'slot-storage', sectionId ?? 'none', slotNo ?? 'none'] as const
};

async function fetchCellSlotStorage(
  sectionId: string,
  slotNo: number
): Promise<CellStorageSnapshotRow[]> {
  return bffRequest<CellStorageSnapshotRow[]>(
    `/api/rack-sections/${sectionId}/slots/${slotNo}/storage`
  );
}

/**
 * Returns cell storage snapshot data for all cells at a given section + slot.
 * An empty array means either the layout is unpublished or the slot is empty.
 */
export function cellSlotStorageQueryOptions(
  sectionId: string | null,
  slotNo: number | null
) {
  return queryOptions({
    queryKey: cellKeys.slotStorage(sectionId, slotNo),
    queryFn: () => fetchCellSlotStorage(sectionId as string, slotNo as number),
    enabled: Boolean(sectionId) && typeof slotNo === 'number' && slotNo >= 1
  });
}
