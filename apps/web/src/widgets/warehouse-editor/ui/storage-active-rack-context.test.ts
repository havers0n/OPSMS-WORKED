import { describe, expect, it } from 'vitest';
import type { Cell } from '@wos/domain';
import type { EditorSelection, ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { resolveStorageActiveRackId } from './storage-active-rack-context';

function makeCell(id: string, rackId: string): Cell {
  return {
    id,
    layoutVersionId: 'lv-1',
    rackId,
    rackFaceId: 'face-a',
    rackSectionId: 'section-a',
    rackLevelId: 'level-1',
    slotNo: 1,
    address: {
      raw: '01-A.01.01.01',
      parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
      sortKey: '0001-A-01-01-01'
    },
    cellCode: 'CELL-1',
    status: 'active'
  };
}

function resolve(params: {
  viewMode: ViewMode;
  selection: EditorSelection;
  selectedRackId: string | null;
  publishedCellsById?: Map<string, Cell>;
}) {
  return resolveStorageActiveRackId({
    viewMode: params.viewMode,
    selection: params.selection,
    selectedRackId: params.selectedRackId,
    publishedCellsById: params.publishedCellsById ?? new Map<string, Cell>()
  });
}

describe('resolveStorageActiveRackId', () => {
  it('returns selected rack id for storage rack selection', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'rack', rackIds: ['rack-1'] },
        selectedRackId: 'rack-1'
      })
    ).toBe('rack-1');
  });

  it('returns parent rack id for storage cell selection', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'cell', cellId: 'cell-1' },
        selectedRackId: null,
        publishedCellsById: new Map([['cell-1', makeCell('cell-1', 'rack-1')]])
      })
    ).toBe('rack-1');
  });

  it('keeps non-storage behavior unchanged', () => {
    expect(
      resolve({
        viewMode: 'view',
        selection: { type: 'cell', cellId: 'cell-1' },
        selectedRackId: null,
        publishedCellsById: new Map([['cell-1', makeCell('cell-1', 'rack-1')]])
      })
    ).toBeNull();
  });

  it('returns null in storage mode for non rack/cell selections', () => {
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'none' },
        selectedRackId: 'rack-1'
      })
    ).toBeNull();
    expect(
      resolve({
        viewMode: 'storage',
        selection: { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' },
        selectedRackId: 'rack-1'
      })
    ).toBeNull();
  });
});
