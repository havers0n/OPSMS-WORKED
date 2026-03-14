import type { Cell, PreviewCell } from '@wos/domain';
import { buildCellStructureKey } from '@wos/domain';

export function indexPublishedCellsByStructure(cells: Cell[]) {
  return new Map(cells.map((cell) => [buildCellStructureKey(cell), cell]));
}

export function resolvePublishedCellForPreviewCell(
  previewCell: PreviewCell,
  cellsByStructure: Map<string, Cell>
) {
  return cellsByStructure.get(buildCellStructureKey(previewCell)) ?? null;
}
