import { describe, expect, it } from 'vitest';
import {
  bondedSnapshotDraftRowSchema,
  bondedSnapshotDraftSchema,
  bondedSnapshotDiagnosticsSchema,
  productControlBondedCandidateSchema,
  skuBondedAggregateSchema,
  buildBondedSnapshotDraftRow,
  aggregateBondedAvailabilityBySku,
  buildSnapshotDiagnostics,
  computeReleasedBalanceQty,
  computeAvailableQty,
  type BondedSnapshotDraftRow,
  type ProductControlBondedCandidate,
  type SkuBondedAggregate
} from './bonded-snapshot';

function validRow(overrides: Partial<BondedSnapshotDraftRow> = {}): BondedSnapshotDraftRow {
  return {
    rowNumber: 2,
    sourceLabel: 'נעמן',
    block: '7488/23',
    sku: '477318',
    description: 'Some product',
    releasedQty: 136,
    packFactor: 20,
    cartonsPerPallet: 20,
    unitsPerPallet: 400,
    pullColumns: [20, 20, 40, 40, 20, null, null, null, null],
    totalPulledQty: 140,
    releasedBalanceQty: -4,
    availableQty: 0,
    notes: null,
    remainingBondedRaw: null,
    diagnostics: ['negative_released_balance'],
    ...overrides
  };
}

// ── Schema tests ──────────────────────────────────────────────────────────

describe('bondedSnapshotDraftRowSchema', () => {
  it('accepts a valid row', () => {
    const row = validRow();
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).not.toThrow();
  });

  it('accepts a row with null SKU and missing_sku diagnostic', () => {
    const row = validRow({ sku: null, diagnostics: ['missing_sku'] });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).not.toThrow();
  });

  it('accepts a row with negative balance and availableQty 0', () => {
    const row = validRow({
      releasedBalanceQty: -10,
      availableQty: 0,
      diagnostics: ['negative_released_balance']
    });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).not.toThrow();
    expect(row.availableQty).toBe(0);
  });

  it('rejects negative availableQty', () => {
    const row = validRow({ availableQty: -1 });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).toThrow();
  });

  it('rejects NaN availableQty', () => {
    const row = validRow({ availableQty: NaN as unknown as number });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).toThrow();
  });

  it('rejects NaN releasedQty', () => {
    const row = validRow({ releasedQty: NaN as unknown as number });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).toThrow();
  });

  it('accepts row with all fields populated', () => {
    const row = validRow({
      sourceLabel: 'מקור',
      block: '1234/56',
      sku: '999999',
      description: 'Full row',
      releasedQty: 500,
      packFactor: 10,
      cartonsPerPallet: 50,
      unitsPerPallet: 500,
      pullColumns: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      totalPulledQty: 450,
      releasedBalanceQty: 50,
      availableQty: 50,
      notes: 'Some notes',
      remainingBondedRaw: '1 spare parts',
      diagnostics: []
    });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).not.toThrow();
    expect(row.remainingBondedRaw).toBe('1 spare parts');
    expect(row.diagnostics).toEqual([]);
  });

  it('rejects rowNumber 0', () => {
    const row = validRow({ rowNumber: 0 });
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).toThrow();
  });
});

describe('productControlBondedCandidateSchema', () => {
  it('accepts a valid candidate', () => {
    const candidate: ProductControlBondedCandidate = {
      block: '7488/23',
      sourceLabel: 'נעמן',
      availableQty: 0,
      releasedQty: 136,
      totalPulledQty: 140,
      releasedBalanceQty: -4,
      packFactor: 20,
      cartonsPerPallet: 20,
      unitsPerPallet: 400,
      notes: null
    };
    expect(() => productControlBondedCandidateSchema.parse(candidate)).not.toThrow();
  });

  it('rejects negative availableQty in candidate', () => {
    const candidate: ProductControlBondedCandidate = {
      block: null,
      sourceLabel: null,
      availableQty: -1,
      releasedQty: 0,
      totalPulledQty: 0,
      releasedBalanceQty: 0,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      notes: null
    };
    expect(() => productControlBondedCandidateSchema.parse(candidate)).toThrow();
  });
});

describe('skuBondedAggregateSchema', () => {
  it('accepts a valid aggregate', () => {
    const agg: SkuBondedAggregate = {
      sku: '477318',
      bondedAvailableQty: 100,
      candidates: [{
        block: '7488/23',
        sourceLabel: 'נעמן',
        availableQty: 100,
        releasedQty: 200,
        totalPulledQty: 100,
        releasedBalanceQty: 100,
        packFactor: 20,
        cartonsPerPallet: 20,
        unitsPerPallet: 400,
        notes: null
      }],
      sourceRowCount: 1,
      diagnostics: []
    };
    expect(() => skuBondedAggregateSchema.parse(agg)).not.toThrow();
  });

  it('rejects negative bondedAvailableQty', () => {
    const agg: SkuBondedAggregate = {
      sku: '477318',
      bondedAvailableQty: -1,
      candidates: [],
      sourceRowCount: 1,
      diagnostics: []
    };
    expect(() => skuBondedAggregateSchema.parse(agg)).toThrow();
  });
});

describe('bondedSnapshotDiagnosticsSchema', () => {
  it('accepts valid diagnostics', () => {
    const diag = {
      totalRows: 468,
      populatedRows: 454,
      missingSkuRows: 14,
      negativeBalanceRows: 5,
      duplicateSkuGroups: 10,
      formulaDiscrepancyRows: 0,
      warnings: ['14 row(s) have missing SKU']
    };
    expect(() => bondedSnapshotDiagnosticsSchema.parse(diag)).not.toThrow();
  });
});

describe('bondedSnapshotDraftSchema', () => {
  it('accepts a valid snapshot', () => {
    const snapshot = {
      sourceSheetName: 'בונדד!',
      rowCount: 1,
      rows: [validRow()],
      diagnostics: {
        totalRows: 1,
        populatedRows: 1,
        missingSkuRows: 0,
        negativeBalanceRows: 1,
        duplicateSkuGroups: 0,
        formulaDiscrepancyRows: 0,
        warnings: ['1 row(s) have negative released balance']
      }
    };
    expect(() => bondedSnapshotDraftSchema.parse(snapshot)).not.toThrow();
  });
});

// ── Helper function tests ─────────────────────────────────────────────────

describe('computeReleasedBalanceQty', () => {
  it('returns releasedQty - totalPulledQty', () => {
    expect(computeReleasedBalanceQty(200, 150)).toBe(50);
  });

  it('returns negative when pulled exceeds released', () => {
    expect(computeReleasedBalanceQty(100, 150)).toBe(-50);
  });

  it('returns zero when equal', () => {
    expect(computeReleasedBalanceQty(100, 100)).toBe(0);
  });
});

describe('computeAvailableQty', () => {
  it('returns positive value as-is', () => {
    expect(computeAvailableQty(50)).toBe(50);
  });

  it('returns 0 for negative', () => {
    expect(computeAvailableQty(-10)).toBe(0);
  });

  it('returns 0 for zero', () => {
    expect(computeAvailableQty(0)).toBe(0);
  });
});

describe('buildBondedSnapshotDraftRow', () => {
  it('builds a valid row with positive balance', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 5,
      sourceLabel: 'מקור א',
      block: '1234/56',
      sku: '100001',
      description: 'Product',
      releasedQty: 200,
      packFactor: 5,
      cartonsPerPallet: 10,
      unitsPerPallet: 50,
      pullColumns: [10, 20, 30, null, null, null, null, null, null],
      totalPulledQty: 120,
      notes: null,
      remainingBondedRaw: null
    });

    expect(row.releasedBalanceQty).toBe(80);
    expect(row.availableQty).toBe(80);
    expect(row.diagnostics).toEqual([]);
    expect(row.sku).toBe('100001');
    expect(() => bondedSnapshotDraftRowSchema.parse(row)).not.toThrow();
  });

  it('builds a row with negative balance → availableQty 0', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 10,
      sourceLabel: null,
      block: '9999/99',
      sku: '100002',
      description: 'Negative',
      releasedQty: 50,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [10, 20, 10, 10, null, null, null, null, null],
      totalPulledQty: 100,
      notes: null,
      remainingBondedRaw: null
    });

    expect(row.releasedBalanceQty).toBe(-50);
    expect(row.availableQty).toBe(0);
    expect(row.diagnostics).toContain('negative_released_balance');
  });

  it('builds a row with missing SKU', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 3,
      sourceLabel: null,
      block: null,
      sku: null,
      description: null,
      releasedQty: 0,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [null, null, null, null, null, null, null, null, null],
      totalPulledQty: 0,
      notes: null,
      remainingBondedRaw: null
    });

    expect(row.sku).toBeNull();
    expect(row.diagnostics).toContain('missing_sku');
  });

  it('trims whitespace from SKU', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 4,
      sourceLabel: null,
      block: null,
      sku: '  100003  ',
      description: null,
      releasedQty: 10,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [null, null, null, null, null, null, null, null, null],
      totalPulledQty: 5,
      notes: null,
      remainingBondedRaw: null
    });

    expect(row.sku).toBe('100003');
    expect(row.diagnostics).toEqual([]);
  });

  it('preserves remainingBondedRaw as-is', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 6,
      sourceLabel: null,
      block: null,
      sku: '100004',
      description: null,
      releasedQty: 10,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [null, null, null, null, null, null, null, null, null],
      totalPulledQty: 0,
      notes: null,
      remainingBondedRaw: '1 spare parts'
    });

    expect(row.remainingBondedRaw).toBe('1 spare parts');
  });

  it('adds released_balance_mismatch diagnostic when cached differs from computed', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 7,
      sourceLabel: null,
      block: null,
      sku: '100005',
      description: null,
      releasedQty: 100,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [],
      totalPulledQty: 50,
      notes: null,
      remainingBondedRaw: null,
      rawReleasedBalanceCellValue: 30
    });

    expect(row.releasedBalanceQty).toBe(50);
    expect(row.availableQty).toBe(50);
    expect(row.diagnostics).toContainEqual(
      expect.stringMatching(/released_balance_mismatch/)
    );
  });

  it('does not add mismatch diagnostic when cached matches computed', () => {
    const row = buildBondedSnapshotDraftRow({
      rowNumber: 8,
      sourceLabel: null,
      block: null,
      sku: '100006',
      description: null,
      releasedQty: 100,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [],
      totalPulledQty: 50,
      notes: null,
      remainingBondedRaw: null,
      rawReleasedBalanceCellValue: 50
    });

    expect(row.diagnostics).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/released_balance_mismatch/)])
    );
  });
});

// ── Aggregate tests ───────────────────────────────────────────────────────

describe('aggregateBondedAvailabilityBySku', () => {
  it('aggregates single SKU correctly', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: 'נעמן', block: '7488/23',
        sku: '477318', description: 'Product A', releasedQty: 200,
        packFactor: 20, cartonsPerPallet: 20, unitsPerPallet: 400,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    expect(result.size).toBe(1);
    expect(result.get('477318')!.bondedAvailableQty).toBe(100);
    expect(result.get('477318')!.sourceRowCount).toBe(1);
    expect(result.get('477318')!.candidates).toHaveLength(1);
  });

  it('sums multiple rows for same SKU', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: 'נעמן', block: '7488/23',
        sku: '477318', description: null, releasedQty: 200,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 10, sourceLabel: 'נעמן', block: '8822/23',
        sku: '477318', description: null, releasedQty: 150,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    expect(result.get('477318')!.bondedAvailableQty).toBe(200);
    expect(result.get('477318')!.sourceRowCount).toBe(2);
    expect(result.get('477318')!.candidates).toHaveLength(2);
  });

  it('produces multiple candidates for duplicate SKU rows', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: 'נעמן', block: '7488/23',
        sku: '477318', description: null, releasedQty: 100,
        packFactor: 20, cartonsPerPallet: 20, unitsPerPallet: 400,
        pullColumns: [], totalPulledQty: 60, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 8, sourceLabel: 'בונדד', block: '8822/23',
        sku: '477318', description: null, releasedQty: 50,
        packFactor: 10, cartonsPerPallet: 10, unitsPerPallet: 100,
        pullColumns: [], totalPulledQty: 30, notes: 'Note B', remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    const agg = result.get('477318')!;
    expect(agg.candidates).toHaveLength(2);

    expect(agg.candidates[0].block).toBe('7488/23');
    expect(agg.candidates[0].packFactor).toBe(20);
    expect(agg.candidates[0].cartonsPerPallet).toBe(20);
    expect(agg.candidates[0].unitsPerPallet).toBe(400);

    expect(agg.candidates[1].block).toBe('8822/23');
    expect(agg.candidates[1].notes).toBe('Note B');
    expect(agg.candidates[1].packFactor).toBe(10);
  });

  it('sorts candidates: availableQty > 0 first, then by rowNumber', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 5, sourceLabel: null, block: 'B',
        sku: 'S001', description: null, releasedQty: 50,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: 'A',
        sku: 'S001', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 30, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    const agg = result.get('S001')!;
    expect(agg.candidates[0].availableQty).toBe(70);
    expect(agg.candidates[0].block).toBe('A');
    expect(agg.candidates[1].availableQty).toBe(0);
    expect(agg.candidates[1].block).toBe('B');
  });

  it('handles negative released balance: availableQty 0, candidate still present', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: 'NEG',
        sku: 'N001', description: null, releasedQty: 30,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    expect(result.get('N001')!.bondedAvailableQty).toBe(0);
    expect(result.get('N001')!.candidates).toHaveLength(1);
    expect(result.get('N001')!.candidates[0].availableQty).toBe(0);
  });

  it('excludes rows with null SKU from aggregate', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: null,
        sku: null, description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 3, sourceLabel: null, block: 'B',
        sku: 'S001', description: null, releasedQty: 200,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    expect(result.size).toBe(1);
    expect(result.get('S001')!.bondedAvailableQty).toBe(100);
  });

  it('aggregates multiple distinct SKUs', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: null,
        sku: 'SKU-1', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 40, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 3, sourceLabel: null, block: null,
        sku: 'SKU-2', description: null, releasedQty: 200,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    expect(result.size).toBe(2);
    expect(result.get('SKU-1')!.bondedAvailableQty).toBe(60);
    expect(result.get('SKU-2')!.bondedAvailableQty).toBe(150);
  });

  it('candidate preserves block, sourceLabel, packaging, notes', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: 'Source X', block: '100/1',
        sku: 'S001', description: 'Desc X', releasedQty: 200,
        packFactor: 5, cartonsPerPallet: 10, unitsPerPallet: 50,
        pullColumns: [], totalPulledQty: 100, notes: 'Note X', remainingBondedRaw: null
      })
    ];

    const result = aggregateBondedAvailabilityBySku(rows);
    const c = result.get('S001')!.candidates[0];
    expect(c.sourceLabel).toBe('Source X');
    expect(c.block).toBe('100/1');
    expect(c.packFactor).toBe(5);
    expect(c.cartonsPerPallet).toBe(10);
    expect(c.unitsPerPallet).toBe(50);
    expect(c.notes).toBe('Note X');
    expect(c.releasedQty).toBe(200);
    expect(c.totalPulledQty).toBe(100);
    expect(c.releasedBalanceQty).toBe(100);
    expect(c.availableQty).toBe(100);
  });

  it('returns empty map for empty input', () => {
    const result = aggregateBondedAvailabilityBySku([]);
    expect(result.size).toBe(0);
  });
});

// ── Diagnostics tests ─────────────────────────────────────────────────────

describe('buildSnapshotDiagnostics', () => {
  it('builds diagnostics for empty input', () => {
    const diag = buildSnapshotDiagnostics([]);
    expect(diag.totalRows).toBe(0);
    expect(diag.warnings).toEqual([]);
  });

  it('counts missing SKU rows', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: null,
        sku: null, description: null, releasedQty: 0,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 0, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 3, sourceLabel: null, block: null,
        sku: 'S001', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      })
    ];

    const diag = buildSnapshotDiagnostics(rows);
    expect(diag.missingSkuRows).toBe(1);
    expect(diag.populatedRows).toBe(1);
    expect(diag.totalRows).toBe(2);
    expect(diag.warnings).toContain('1 row(s) have missing SKU');
  });

  it('counts negative balance rows', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: null,
        sku: 'NEG', description: null, releasedQty: 30,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 100, notes: null, remainingBondedRaw: null
      })
    ];

    const diag = buildSnapshotDiagnostics(rows);
    expect(diag.negativeBalanceRows).toBe(1);
    expect(diag.warnings).toContain('1 row(s) have negative released balance');
  });

  it('counts duplicate SKU groups with multiple rows', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: 'A',
        sku: 'DUP', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      }),
      buildBondedSnapshotDraftRow({
        rowNumber: 3, sourceLabel: null, block: 'B',
        sku: 'DUP', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null
      })
    ];

    const diag = buildSnapshotDiagnostics(rows);
    expect(diag.duplicateSkuGroups).toBe(1);
    expect(diag.warnings).toContain('1 SKU(s) have multiple bonded candidates');
  });

  it('counts formula discrepancy rows', () => {
    const rows = [
      buildBondedSnapshotDraftRow({
        rowNumber: 2, sourceLabel: null, block: null,
        sku: 'S001', description: null, releasedQty: 100,
        packFactor: null, cartonsPerPallet: null, unitsPerPallet: null,
        pullColumns: [], totalPulledQty: 50, notes: null, remainingBondedRaw: null,
        rawReleasedBalanceCellValue: 30
      })
    ];

    const diag = buildSnapshotDiagnostics(rows);
    expect(diag.formulaDiscrepancyRows).toBe(1);
  });
});
