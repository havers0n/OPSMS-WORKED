export type HasCellAndContainer = {
  cellId: string | null;
  containerId: string;
};

export interface OptimisticMoveParams {
  sourceCellId: string;
  containerId: string;
  targetCellId: string;
  targetLocationId: string;
  targetLocationCode: string;
}

export function applyOptimisticContainerMove<T extends HasCellAndContainer>(
  rows: T[],
  params: OptimisticMoveParams,
  toTargetRow: (row: T) => T
): T[] {
  const kept: T[] = [];
  const moved: T[] = [];

  for (const row of rows) {
    if (row.cellId === params.sourceCellId && row.containerId === params.containerId) {
      moved.push(toTargetRow(row));
    } else {
      kept.push(row);
    }
  }

  if (moved.length === 0) return kept;

  const targetContainerIds = new Set(
    kept.filter((r) => r.cellId !== params.sourceCellId).map((r) => r.containerId)
  );

  if (!targetContainerIds.has(params.containerId)) {
    kept.push(...moved);
  }

  return kept;
}
