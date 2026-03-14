import type { CellStorageSnapshotRow } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export type CellSlotStorageData = {
  /** True when the layout version has been published and persisted cell UUIDs exist. */
  published: boolean;
  /** Storage snapshot rows; empty array when cell is published but genuinely empty. */
  rows: CellStorageSnapshotRow[];
};

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
): Promise<CellSlotStorageData> {
  return bffRequest<CellSlotStorageData>(
    `/api/rack-sections/${sectionId}/slots/${slotNo}/storage`
  );
}

/**
 * Returns cell storage snapshot data for a given section + slot.
 * `data.published` distinguishes "layout not published" from "genuinely empty cell":
 *   - published=false → layout has never been published; cells don't exist in DB yet.
 *   - published=true, rows=[] → layout published but this slot has no containers.
 *   - published=true, rows=[...] → containers present.
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
