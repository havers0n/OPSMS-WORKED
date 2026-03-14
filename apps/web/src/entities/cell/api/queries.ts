import type { Cell, CellStorageSnapshotRow, FloorCellOccupancyRow } from '@wos/domain';
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
  storage: (cellId: string | null) =>
    [...cellKeys.all, 'storage', cellId ?? 'none'] as const,
  occupancyByFloor: (floorId: string | null) =>
    [...cellKeys.all, 'occupancy-by-floor', floorId ?? 'none'] as const,
  publishedByFloor: (floorId: string | null) =>
    [...cellKeys.all, 'published-by-floor', floorId ?? 'none'] as const,
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

async function fetchCellStorage(cellId: string): Promise<CellStorageSnapshotRow[]> {
  return bffRequest<CellStorageSnapshotRow[]>(`/api/cells/${cellId}/storage`);
}

async function fetchFloorCellOccupancy(floorId: string): Promise<FloorCellOccupancyRow[]> {
  return bffRequest<FloorCellOccupancyRow[]>(`/api/floors/${floorId}/cell-occupancy`);
}

async function fetchPublishedCells(floorId: string): Promise<Cell[]> {
  return bffRequest<Cell[]>(`/api/floors/${floorId}/published-cells`);
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

export function cellStorageQueryOptions(cellId: string | null) {
  return queryOptions({
    queryKey: cellKeys.storage(cellId),
    queryFn: () => fetchCellStorage(cellId as string),
    enabled: Boolean(cellId)
  });
}

export function floorCellOccupancyQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: cellKeys.occupancyByFloor(floorId),
    queryFn: () => fetchFloorCellOccupancy(floorId as string),
    enabled: Boolean(floorId)
  });
}

export function publishedCellsQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: cellKeys.publishedByFloor(floorId),
    queryFn: () => fetchPublishedCells(floorId as string),
    enabled: Boolean(floorId)
  });
}
