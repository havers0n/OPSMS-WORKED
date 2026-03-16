export function indexOccupiedCellIds(rows: Array<{ cellId: string | null }>) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.cellId !== null) {
      ids.add(row.cellId);
    }
  }
  return ids;
}
