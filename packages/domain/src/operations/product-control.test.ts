import { describe, expect, it } from 'vitest';
import {
  productControlRowSchema,
  productControlTotalsSchema,
  productControlResponseSchema,
  productControlStatusSchema,
  deriveShortageQty,
  deriveBondedCoverQty,
  deriveFinalMissingQty,
  deriveSurplusQty,
  deriveProductControlStatus,
  computeProductControlTotals,
  buildProductControlRow,
  type ProductControlRow,
  type ProductControlStatus
} from './product-control';

function validRow(overrides: Partial<ProductControlRow> = {}): ProductControlRow {
  return {
    sku: '100001',
    description: 'Test Product',
    category: 'Test',
    demandQty: 500,
    warehouseQty: 500,
    shortageQty: 0,
    bondedAvailableQty: 0,
    bondedCoverQty: 0,
    finalMissingQty: 0,
    surplusQty: 0,
    status: 'ok',
    ...overrides
  };
}

describe('productControlStatusSchema', () => {
  it('accepts valid statuses', () => {
    const valid: ProductControlStatus[] = [
      'ok',
      'covered_by_bonded',
      'partial_bonded',
      'unresolved',
      'data_issue'
    ];
    for (const s of valid) {
      expect(productControlStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid status', () => {
    expect(() => productControlStatusSchema.parse('invalid')).toThrow();
  });
});

describe('productControlRowSchema', () => {
  it('accepts a valid "ok" row', () => {
    const row = validRow();
    expect(() => productControlRowSchema.parse(row)).not.toThrow();
  });

  it('accepts a valid row with data_issue status and non-negative numbers', () => {
    const row = validRow({
      status: 'data_issue',
      demandQty: 0,
      warehouseQty: 9999,
      notes: 'Data issue'
    });
    expect(() => productControlRowSchema.parse(row)).not.toThrow();
  });

  it('rejects negative shortageQty', () => {
    const row = validRow({ shortageQty: -1 });
    expect(() => productControlRowSchema.parse(row)).toThrow();
  });

  it('rejects NaN shortageQty', () => {
    const row = validRow({ shortageQty: NaN });
    expect(() => productControlRowSchema.parse(row)).toThrow();
  });

  it('rejects fractional shortageSkus in totals', () => {
    expect(() =>
      productControlTotalsSchema.parse({
        totalSkus: 4.5,
        shortageSkus: 0,
        coveredByBondedSkus: 0,
        partialBondedSkus: 0,
        unresolvedSkus: 0,
        dataIssueSkus: 0
      })
    ).toThrow();
  });

  it('accepts optional bonded fields', () => {
    const row = validRow({
      bondedCandidateLabel: 'מחסן בונדד A — מדף 12',
      bondedCandidateBlock: '3346/26',
      bondedCandidateSource: 'נעמן',
      bondedCandidateUnitsPerPallet: 960,
      bondedCandidateCartonsPerPallet: 40,
      bondedCandidatePackFactor: 24,
      bondedCandidateAlreadyPulled: 0,
      bondedCandidateAvailableBalance: 200,
      workLines: [
        { name: 'Line A', units: 80, blockedOrders: 2 }
      ],
      notes: 'Some note'
    });
    expect(() => productControlRowSchema.parse(row)).not.toThrow();
  });

  it('rejects fractional bondedCandidateUnitsPerPallet', () => {
    const row = validRow({ bondedCandidateUnitsPerPallet: 1.5 });
    expect(() => productControlRowSchema.parse(row)).toThrow();
  });

  it('rejects negative workLines units', () => {
    const row = validRow({
      workLines: [{ name: 'Line A', units: -1, blockedOrders: 0 }]
    });
    expect(() => productControlRowSchema.parse(row)).toThrow();
  });
});

describe('productControlResponseSchema', () => {
  it('accepts valid response shape', () => {
    const response = {
      shiftId: '33333333-3333-4333-8333-333333333333',
      generatedAt: '2026-06-20T10:00:00.000Z',
      rows: [validRow()],
      totals: {
        totalSkus: 1,
        shortageSkus: 0,
        coveredByBondedSkus: 0,
        partialBondedSkus: 0,
        unresolvedSkus: 0,
        dataIssueSkus: 0
      }
    };
    expect(() => productControlResponseSchema.parse(response)).not.toThrow();
  });

  it('accepts response without UUID format shiftId', () => {
    const response = {
      shiftId: 'shift-1',
      generatedAt: '2026-06-20T10:00:00.000Z',
      rows: [],
      totals: {
        totalSkus: 0,
        shortageSkus: 0,
        coveredByBondedSkus: 0,
        partialBondedSkus: 0,
        unresolvedSkus: 0,
        dataIssueSkus: 0
      }
    };
    expect(() => productControlResponseSchema.parse(response)).not.toThrow();
  });
});

describe('deriveShortageQty', () => {
  it('returns 0 when demand <= warehouse', () => {
    expect(deriveShortageQty(100, 200)).toBe(0);
    expect(deriveShortageQty(100, 100)).toBe(0);
  });

  it('returns positive difference when demand > warehouse', () => {
    expect(deriveShortageQty(200, 100)).toBe(100);
  });
});

describe('deriveBondedCoverQty', () => {
  it('returns shortage when bonded covers fully', () => {
    expect(deriveBondedCoverQty(100, 200)).toBe(100);
  });

  it('returns bonded when bonded partially covers', () => {
    expect(deriveBondedCoverQty(100, 50)).toBe(50);
  });

  it('returns 0 when no bonded available', () => {
    expect(deriveBondedCoverQty(100, 0)).toBe(0);
  });
});

describe('deriveFinalMissingQty', () => {
  it('returns 0 when bonded covers fully', () => {
    expect(deriveFinalMissingQty(100, 100)).toBe(0);
  });

  it('returns remaining after partial cover', () => {
    expect(deriveFinalMissingQty(100, 40)).toBe(60);
  });

  it('returns shortage when no bonded cover', () => {
    expect(deriveFinalMissingQty(100, 0)).toBe(100);
  });
});

describe('deriveSurplusQty', () => {
  it('returns positive when warehouse > demand', () => {
    expect(deriveSurplusQty(200, 100)).toBe(100);
  });

  it('returns 0 when warehouse <= demand', () => {
    expect(deriveSurplusQty(50, 100)).toBe(0);
    expect(deriveSurplusQty(100, 100)).toBe(0);
  });
});

describe('deriveProductControlStatus', () => {
  const cases: {
    name: string;
    shortage: number;
    bondedCover: number;
    bondedAvailable: number;
    expected: ProductControlStatus;
  }[] = [
    { name: 'ok', shortage: 0, bondedCover: 0, bondedAvailable: 0, expected: 'ok' },
    { name: 'covered_by_bonded', shortage: 100, bondedCover: 100, bondedAvailable: 200, expected: 'covered_by_bonded' },
    { name: 'covered_by_bonded exact', shortage: 100, bondedCover: 100, bondedAvailable: 100, expected: 'covered_by_bonded' },
    { name: 'partial_bonded', shortage: 100, bondedCover: 50, bondedAvailable: 50, expected: 'partial_bonded' },
    { name: 'unresolved', shortage: 100, bondedCover: 0, bondedAvailable: 0, expected: 'unresolved' }
  ];

  for (const c of cases) {
    it(`derives status "${c.expected}" for ${c.name}`, () => {
      expect(deriveProductControlStatus(c.shortage, c.bondedCover, c.bondedAvailable)).toBe(c.expected);
    });
  }
});

describe('computeProductControlTotals', () => {
  it('computes correct totals for mixed statuses', () => {
    const rows = [
      { status: 'ok' as const },
      { status: 'covered_by_bonded' as const },
      { status: 'covered_by_bonded' as const },
      { status: 'partial_bonded' as const },
      { status: 'unresolved' as const },
      { status: 'data_issue' as const }
    ];
    const totals = computeProductControlTotals(rows);
    expect(totals).toEqual({
      totalSkus: 6,
      shortageSkus: 4,
      coveredByBondedSkus: 2,
      partialBondedSkus: 1,
      unresolvedSkus: 1,
      dataIssueSkus: 1
    });
  });

  it('returns zero totals for empty array', () => {
    const totals = computeProductControlTotals([]);
    expect(totals).toEqual({
      totalSkus: 0,
      shortageSkus: 0,
      coveredByBondedSkus: 0,
      partialBondedSkus: 0,
      unresolvedSkus: 0,
      dataIssueSkus: 0
    });
  });

  it('excludes data_issue from ok or shortage counts', () => {
    const rows = [{ status: 'data_issue' as const }, { status: 'data_issue' as const }];
    const totals = computeProductControlTotals(rows);
    expect(totals.totalSkus).toBe(2);
    expect(totals.shortageSkus).toBe(0);
    expect(totals.dataIssueSkus).toBe(2);
  });
});

describe('buildProductControlRow', () => {
  it('builds row with derived quantities and status', () => {
    const row = buildProductControlRow({
      sku: '100001',
      description: 'Test',
      category: 'Cat',
      demandQty: 500,
      warehouseQty: 100,
      bondedAvailableQty: 300
    });
    expect(row.shortageQty).toBe(400);
    expect(row.bondedCoverQty).toBe(300);
    expect(row.finalMissingQty).toBe(100);
    expect(row.surplusQty).toBe(0);
    expect(row.status).toBe('partial_bonded');
  });

  it('builds row with explicit status override', () => {
    const row = buildProductControlRow({
      sku: '999999',
      description: 'Issue',
      category: '—',
      demandQty: 0,
      warehouseQty: 9999,
      bondedAvailableQty: 0,
      status: 'data_issue',
      notes: 'Manual override'
    });
    expect(row.status).toBe('data_issue');
    expect(row.notes).toBe('Manual override');
  });

  it('builds ok row when no shortage', () => {
    const row = buildProductControlRow({
      sku: '100002',
      description: 'Full',
      category: 'Cat',
      demandQty: 100,
      warehouseQty: 200,
      bondedAvailableQty: 0
    });
    expect(row.shortageQty).toBe(0);
    expect(row.surplusQty).toBe(100);
    expect(row.status).toBe('ok');
  });
});
