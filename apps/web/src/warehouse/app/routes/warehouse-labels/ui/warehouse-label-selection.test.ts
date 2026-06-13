import { describe, expect, it } from 'vitest';
import type { Cell, RackSlotLocationRef } from '@wos/domain';
import {
  buildRackLevelOptions,
  buildWarehouseLabelSelection,
  getCellLevelKey,
  normalizeLocationIds,
  resolveSelectedLocationIds,
  type LabelSelectionState
} from './warehouse-label-selection';

function createCell(overrides: Partial<Cell> = {}): Cell {
  return {
    id: 'cell-1',
    layoutVersionId: 'layout-1',
    rackId: 'rack-1',
    rackFaceId: 'face-1',
    rackSectionId: 'section-1',
    rackLevelId: 'level-1',
    slotNo: 1,
    address: {
      raw: '01-A.01.01.01',
      parts: {
        rackCode: '01',
        face: 'A',
        section: 1,
        level: 1,
        slot: 1
      },
      sortKey: '0001-A-01-01-01'
    },
    status: 'active',
    cellCode: 'CELL-1',
    ...overrides
  };
}

describe('warehouse label selection helpers', () => {
  it('preserves string-formatted level keys', () => {
    const cell = createCell({
      address: {
        raw: '01-A.01.L1.01',
        parts: {
          rackCode: '01',
          face: 'A',
          section: 1,
          level: 'L1' as never,
          slot: 1
        },
        sortKey: '0001-A-01-L1-01'
      }
    });

    expect(getCellLevelKey(cell)).toBe('L1');
  });

  it('sorts and deduplicates selected location ids', () => {
    expect(normalizeLocationIds(['loc-3', 'loc-1', 'loc-2', 'loc-1'])).toEqual([
      'loc-1',
      'loc-2',
      'loc-3'
    ]);
  });

  it('keeps selection state plain and serializable', () => {
    const selectionState: LabelSelectionState = {
      mode: 'by-rack',
      selected: {
        'rack-1': 'all',
        'rack-2': ['01', 'L1']
      }
    };

    expect(JSON.parse(JSON.stringify(selectionState))).toEqual(selectionState);
  });

  it('builds stable location-id selections from rack-level state', () => {
    const cells: Cell[] = [
      createCell({
        id: 'cell-a',
        address: {
          raw: '01-A.01.01.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
          sortKey: '0001-A-01-01-01'
        }
      }),
      createCell({
        id: 'cell-b',
        address: {
          raw: '01-A.01.01.02',
          parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 2 },
          sortKey: '0001-A-01-01-02'
        }
      }),
      createCell({
        id: 'cell-c',
        rackLevelId: 'level-l1',
        address: {
          raw: '01-A.01.L1.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 'L1' as never, slot: 1 },
          sortKey: '0001-A-01-L1-01'
        }
      })
    ];
    const refs: RackSlotLocationRef[] = [
      { cellId: 'cell-a', locationId: 'loc-2' },
      { cellId: 'cell-b', locationId: 'loc-1' },
      { cellId: 'cell-c', locationId: 'loc-3' }
    ];
    const rackLevelOptions = buildRackLevelOptions(cells, refs);
    const selectionState: LabelSelectionState = {
      mode: 'by-rack',
      selected: {
        'rack-1': ['1', 'L1']
      }
    };

    expect(resolveSelectedLocationIds(selectionState, rackLevelOptions)).toEqual([
      'loc-1',
      'loc-2',
      'loc-3'
    ]);
    expect(buildWarehouseLabelSelection(selectionState, rackLevelOptions)).toEqual({
      mode: 'location-ids',
      locationIds: ['loc-1', 'loc-2', 'loc-3']
    });
  });
});
