import { describe, expect, it } from 'vitest';
import { applyOptimisticContainerMove, type HasCellAndContainer, type OptimisticMoveParams } from './optimistic-move';

type TestRow = HasCellAndContainer & {
  locationId: string;
  locationCode: string;
  externalCode: string | null;
};

const defaultParams: OptimisticMoveParams = {
  sourceCellId: 'src-cell',
  containerId: 'c-1',
  targetCellId: 'tgt-cell',
  targetLocationId: 'tgt-loc',
  targetLocationCode: 'TGT.01'
};

function update(row: TestRow, params: OptimisticMoveParams = defaultParams): TestRow {
  return {
    ...row,
    cellId: params.targetCellId,
    locationId: params.targetLocationId,
    locationCode: params.targetLocationCode
  };
}

const srcRowA: TestRow = {
  cellId: 'src-cell',
  containerId: 'c-1',
  locationId: 'src-loc',
  locationCode: 'SRC.01',
  externalCode: 'CONT-001'
};

const srcRowB: TestRow = {
  cellId: 'src-cell',
  containerId: 'c-2',
  locationId: 'src-loc',
  locationCode: 'SRC.01',
  externalCode: 'CONT-002'
};

const tgtExistingRow: TestRow = {
  cellId: 'tgt-cell',
  containerId: 'c-3',
  locationId: 'tgt-loc',
  locationCode: 'TGT.01',
  externalCode: 'CONT-003'
};

describe('applyOptimisticContainerMove', () => {
  it('moves occupied state from source to target', () => {
    const rows = [srcRowA, srcRowB];
    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    expect(result).toHaveLength(2);
    // c-1 moved from src-cell to tgt-cell
    expect(result.find((r) => r.cellId === 'src-cell' && r.containerId === 'c-1')).toBeUndefined();
    expect(result.find((r) => r.cellId === 'tgt-cell')?.containerId).toBe('c-1');
    expect(result.find((r) => r.containerId === 'c-1')?.locationCode).toBe('TGT.01');
    // c-2 remains at src-cell
    expect(result.find((r) => r.containerId === 'c-2')?.cellId).toBe('src-cell');
  });

  it('does not duplicate an existing target row with the same containerId', () => {
    const sameContainerAtTarget: TestRow = {
      cellId: 'tgt-cell',
      containerId: 'c-1',
      locationId: 'tgt-loc',
      locationCode: 'TGT.01',
      externalCode: 'CONT-001'
    };
    const rows = [srcRowA, sameContainerAtTarget];
    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    // Only 2 rows: srcRowB (not affected, but doesn't exist) + sameContainerAtTarget
    expect(result).toHaveLength(1);
    expect(result[0].containerId).toBe('c-1');
    expect(result[0].cellId).toBe('tgt-cell');
  });

  it('preserves unrelated rows', () => {
    const unrelated: TestRow = {
      cellId: 'other-cell',
      containerId: 'c-99',
      locationId: 'other-loc',
      locationCode: 'OTH.01',
      externalCode: 'CONT-099'
    };
    const rows = [srcRowA, srcRowB, unrelated];
    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.containerId === 'c-99')).toBeDefined();
    expect(result.find((r) => r.containerId === 'c-99')?.cellId).toBe('other-cell');
  });

  it('handles absent source row safely', () => {
    const rows: TestRow[] = [tgtExistingRow];
    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    expect(result).toHaveLength(1);
    expect(result[0].containerId).toBe('c-3');
  });

  it('handles empty rows array', () => {
    const result = applyOptimisticContainerMove<TestRow>([], defaultParams, (r) => update(r));
    expect(result).toEqual([]);
  });

  it('moves all container rows (multiple inventory rows per container)', () => {
    const rowA1: TestRow = { ...srcRowA, locationId: 'src-loc' };
    const rowA2: TestRow = { ...srcRowA, locationId: 'src-loc' };
    const rows = [rowA1, rowA2, srcRowB];

    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.cellId === 'src-cell')).toHaveLength(1);
    expect(result.filter((r) => r.cellId === 'src-cell')[0].containerId).toBe('c-2');
    expect(result.filter((r) => r.cellId === 'tgt-cell')).toHaveLength(2);
  });

  it('does not mutate input array', () => {
    const rows = [srcRowA, srcRowB];
    const copy = [...rows];
    applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));
    expect(rows).toEqual(copy);
  });

  it('skips adding target row when same container exists at another non-source cell', () => {
    const otherLocation: TestRow = {
      cellId: 'other-cell',
      containerId: 'c-1',
      locationId: 'other-loc',
      locationCode: 'OTH.01',
      externalCode: 'CONT-001'
    };
    const rows = [srcRowA, otherLocation];

    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    // srcRowA removed, otherLocation kept, nothing added to tgt-cell (already at other-cell)
    expect(result.find((r) => r.cellId === 'src-cell')).toBeUndefined();
    expect(result.find((r) => r.cellId === 'tgt-cell')).toBeUndefined();
    expect(result.find((r) => r.cellId === 'other-cell')).toBeDefined();
  });

  it('does not move rows where containerId does not match', () => {
    const params: OptimisticMoveParams = { ...defaultParams, containerId: 'c-nonexistent' };
    const rows = [srcRowA, srcRowB];

    const result = applyOptimisticContainerMove(rows, params, (r) => update(r));

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.cellId === 'src-cell')).toBeDefined();
    expect(result.find((r) => r.cellId === 'tgt-cell')).toBeUndefined();
  });

  it('preserves multiple unrelated rows when moving', () => {
    const unrelatedA: TestRow = {
      cellId: 'other-a',
      containerId: 'c-10',
      locationId: 'oth-a',
      locationCode: 'OTH.A',
      externalCode: 'C010'
    };
    const unrelatedB: TestRow = {
      cellId: 'other-b',
      containerId: 'c-11',
      locationId: 'oth-b',
      locationCode: 'OTH.B',
      externalCode: 'C011'
    };
    const rows = [srcRowA, unrelatedA, unrelatedB];

    const result = applyOptimisticContainerMove(rows, defaultParams, (r) => update(r));

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.containerId === 'c-10')).toBeDefined();
    expect(result.find((r) => r.containerId === 'c-11')).toBeDefined();
    expect(result.find((r) => r.containerId === 'c-1')?.cellId).toBe('tgt-cell');
  });
});
