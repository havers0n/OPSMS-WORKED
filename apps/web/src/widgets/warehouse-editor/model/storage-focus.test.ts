import { describe, expect, it } from 'vitest';
import type { Cell } from '@wos/domain';
import type { EditorSelection, ViewMode } from './editor-types';
import { resolveStorageFocusContext } from './storage-focus';

function makeCell(id: string, rackId: string, level = 1): Cell {
  return {
    id,
    layoutVersionId: 'lv-1',
    rackId,
    rackFaceId: 'face-a',
    rackSectionId: 'section-a',
    rackLevelId: `level-${level}`,
    slotNo: 1,
    address: {
      raw: `01-A.01.0${level}.01`,
      parts: { rackCode: '01', face: 'A', section: 1, level, slot: 1 },
      sortKey: `0001-A-01-0${level}-01`
    },
    cellCode: 'CELL-1',
    status: 'active'
  };
}

function makeRackCells(rackId: string, levels: number[]) {
  return levels.map((level, idx) => makeCell(`cell-${rackId}-${level}-${idx}`, rackId, level));
}

function resolve(params: {
  viewMode: ViewMode;
  selection: EditorSelection;
  selectedRackActiveLevel: number;
  publishedCellsById?: Map<string, Cell>;
}) {
  return resolveStorageFocusContext({
    viewMode: params.viewMode,
    selection: params.selection,
    selectedRackActiveLevel: params.selectedRackActiveLevel,
    publishedCellsById: params.publishedCellsById ?? new Map<string, Cell>()
  });
}

describe('resolveStorageFocusContext', () => {
  it('resolves storage rack selection', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'rack', rackIds: ['rack-1'] },
        selectedRackActiveLevel: 2
      })
    ).toEqual({
      leaf: 'rack',
      rackId: 'rack-1',
      resolvedCellId: null,
      resolvedContainerId: null,
      activeLevel: 2,
      hasResolvedRackContext: true,
      isOffLevel: false
    });
  });

  it('handles malformed storage rack selection with empty rackIds', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'rack', rackIds: [] },
        selectedRackActiveLevel: 3
      })
    ).toEqual({
      leaf: 'rack',
      rackId: null,
      resolvedCellId: null,
      resolvedContainerId: null,
      activeLevel: 3,
      hasResolvedRackContext: false,
      isOffLevel: false
    });
  });

  it('preserves current contract: resolves storage cell selection and computes off-level from existing semantics', () => {
    const rackCells = makeRackCells('rack-1', [1, 3, 5]);
    const selectedCell = rackCells.find((cell) => cell.address.parts.level === 3) as Cell;
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'cell', cellId: selectedCell.id },
        selectedRackActiveLevel: 0,
        publishedCellsById: new Map(rackCells.map((cell) => [cell.id, cell] as const))
      })
    ).toEqual({
      leaf: 'cell',
      rackId: 'rack-1',
      resolvedCellId: selectedCell.id,
      resolvedContainerId: null,
      activeLevel: 0,
      hasResolvedRackContext: true,
      isOffLevel: true
    });
  });

  it('preserves current contract: preserves unresolved cell leaf identity without fabricating rack context', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'cell', cellId: 'missing-cell' },
        selectedRackActiveLevel: 2
      })
    ).toEqual({
      leaf: 'cell',
      rackId: null,
      resolvedCellId: 'missing-cell',
      resolvedContainerId: null,
      activeLevel: 2,
      hasResolvedRackContext: false,
      isOffLevel: false
    });
  });

  it('returns isOffLevel=false when cell level is missing', () => {
    const baseCell = makeCell('cell-1', 'rack-1', 2);
    const { level: _droppedLevel, ...partsWithoutLevel } = baseCell.address.parts;
    const cellWithMissingLevel = {
      ...baseCell,
      address: {
        ...baseCell.address,
        parts: partsWithoutLevel
      }
    } as unknown as Cell;

    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'cell', cellId: 'cell-1' },
        selectedRackActiveLevel: 0,
        publishedCellsById: new Map([['cell-1', cellWithMissingLevel]])
      })
    ).toEqual({
      leaf: 'cell',
      rackId: 'rack-1',
      resolvedCellId: 'cell-1',
      resolvedContainerId: null,
      activeLevel: 0,
      hasResolvedRackContext: true,
      isOffLevel: false
    });
  });

  it('resolves storage container selection when sourceCellId restores parent rack context', () => {
    const rackCells = makeRackCells('rack-1', [1, 3, 5]);
    const selectedCell = rackCells.find((cell) => cell.address.parts.level === 3) as Cell;
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'container', containerId: 'container-1', sourceCellId: selectedCell.id },
        selectedRackActiveLevel: 0,
        publishedCellsById: new Map(rackCells.map((cell) => [cell.id, cell] as const))
      })
    ).toEqual({
      leaf: 'cell',
      rackId: 'rack-1',
      resolvedCellId: selectedCell.id,
      resolvedContainerId: 'container-1',
      activeLevel: 0,
      hasResolvedRackContext: true,
      isOffLevel: true
    });
  });

  it('supports sparse rack levels for off-level comparison', () => {
    const rackCells = makeRackCells('rack-1', [1, 3, 5]);
    const selectedCell = rackCells.find((cell) => cell.address.parts.level === 3) as Cell;
    const context = resolve({
      viewMode: 'storage',
      selection: { type: 'cell', cellId: selectedCell.id },
      selectedRackActiveLevel: 2,
      publishedCellsById: new Map(rackCells.map((cell) => [cell.id, cell] as const))
    });

    expect(context.isOffLevel).toBe(true);
    expect(context.activeLevel).toBe(2);
  });

  it('returns isOffLevel=false when active semantic level cannot be resolved from available published cells', () => {
    const partialRackCells = makeRackCells('rack-1', [3]);
    const selectedCell = partialRackCells[0] as Cell;
    const context = resolve({
      viewMode: 'storage',
      selection: { type: 'cell', cellId: selectedCell.id },
      selectedRackActiveLevel: 2,
      publishedCellsById: new Map(partialRackCells.map((cell) => [cell.id, cell] as const))
    });

    expect(context.isOffLevel).toBe(false);
  });

  it('keeps explicit unresolved fallback context for storage container when sourceCellId is missing', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'container', containerId: 'container-1' },
        selectedRackActiveLevel: 1
      })
    ).toEqual({
      leaf: 'none',
      rackId: null,
      resolvedCellId: null,
      resolvedContainerId: 'container-1',
      activeLevel: 1,
      hasResolvedRackContext: false,
      isOffLevel: false
    });
  });

  it('keeps explicit unresolved fallback context for storage container when sourceCellId cannot be resolved', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'container', containerId: 'container-1', sourceCellId: 'missing-cell' },
        selectedRackActiveLevel: 1
      })
    ).toEqual({
      leaf: 'none',
      rackId: null,
      resolvedCellId: null,
      resolvedContainerId: 'container-1',
      activeLevel: 1,
      hasResolvedRackContext: false,
      isOffLevel: false
    });
  });

  it('returns non-storage none-context and keeps activeLevel pass-through', () => {
    expect(
      resolve({
        viewMode: 'view',
        selection: { type: 'cell', cellId: 'cell-1' },
        selectedRackActiveLevel: 7,
        publishedCellsById: new Map([['cell-1', makeCell('cell-1', 'rack-1', 8)]])
      })
    ).toEqual({
      leaf: 'none',
      rackId: null,
      resolvedCellId: null,
      resolvedContainerId: null,
      activeLevel: 7,
      hasResolvedRackContext: false,
      isOffLevel: false
    });
  });
});
