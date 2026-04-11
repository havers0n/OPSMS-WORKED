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
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'cell', cellId: 'cell-1' },
        selectedRackActiveLevel: 1,
        publishedCellsById: new Map([['cell-1', makeCell('cell-1', 'rack-1', 3)]])
      })
    ).toEqual({
      leaf: 'cell',
      rackId: 'rack-1',
      resolvedCellId: 'cell-1',
      resolvedContainerId: null,
      activeLevel: 1,
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
    const cellWithMissingLevel = makeCell('cell-1', 'rack-1', 2) as Cell & {
      address: { parts: { level?: number } };
    };
    delete cellWithMissingLevel.address.parts.level;

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

  it('characterizes current transitional behavior: storage container selection remains none-context and does not infer rack context from sourceCellId', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' },
        selectedRackActiveLevel: 1
      })
    ).toEqual({
      leaf: 'none',
      rackId: null,
      resolvedCellId: null,
      resolvedContainerId: null,
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
