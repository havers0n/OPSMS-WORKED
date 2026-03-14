import type { FloorCellOccupancyRow } from '@wos/domain';

export function indexOccupiedCellIds(rows: FloorCellOccupancyRow[]) {
  return new Set(rows.map((row) => row.cellId));
}
