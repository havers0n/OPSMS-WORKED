import { describe, expect, it } from 'vitest';
import type { ProductPackagingLevel } from '@wos/domain';
import { derivePackagingHierarchy } from './packaging-hierarchy';

function makeLevel(overrides: Partial<ProductPackagingLevel>): ProductPackagingLevel {
  return {
    id: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    code: 'EA',
    name: 'Each',
    baseUnitQty: 1,
    isBase: false,
    canPick: true,
    canStore: true,
    isDefaultPickUom: false,
    barcode: null,
    packWeightG: null,
    packWidthMm: null,
    packHeightMm: null,
    packDepthMm: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('derivePackagingHierarchy', () => {
  it('handles single active base level', () => {
    const base = makeLevel({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: 1, sortOrder: 0 });

    const result = derivePackagingHierarchy([base]);

    expect(result.activeCount).toBe(1);
    expect(result.hasCleanChain).toBe(true);
    expect(result.topMessage).toBe('Only base packaging level configured.');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.isReferenceRoot).toBe(true);
    expect(result.entries[0]?.nestedChildId).toBeNull();
  });

  it('builds a clean chain for divisible active levels', () => {
    const unit = makeLevel({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: 1, sortOrder: 0 });
    const inner = makeLevel({ code: 'INR', name: 'Inner box', baseUnitQty: 6, sortOrder: 1 });
    const carton = makeLevel({ code: 'CTN', name: 'Carton', baseUnitQty: 24, sortOrder: 2 });
    const master = makeLevel({ code: 'MST', name: 'Master case', baseUnitQty: 96, sortOrder: 3 });

    const result = derivePackagingHierarchy([unit, inner, carton, master]);

    expect(result.hasCleanChain).toBe(true);
    expect(result.hasImperfectChain).toBe(false);
    const cartonEntry = result.entries.find((entry) => entry.id === carton.id);
    const masterEntry = result.entries.find((entry) => entry.id === master.id);

    expect(cartonEntry?.nestedChildId).toBe(inner.id);
    expect(cartonEntry?.nestedCount).toBe(4);
    expect(masterEntry?.nestedChildId).toBe(carton.id);
    expect(masterEntry?.nestedCount).toBe(4);
  });

  it('shows partial hierarchy when chain is imperfect', () => {
    const unit = makeLevel({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: 1, sortOrder: 0 });
    const inner = makeLevel({ code: 'INR', name: 'Inner box', baseUnitQty: 6, sortOrder: 1 });
    const odd = makeLevel({ code: 'ODD', name: 'Odd case', baseUnitQty: 25, sortOrder: 2 });

    const result = derivePackagingHierarchy([unit, inner, odd]);

    expect(result.hasCleanChain).toBe(false);
    expect(result.hasImperfectChain).toBe(true);
    const oddEntry = result.entries.find((entry) => entry.id === odd.id);

    expect(oddEntry?.nestedChildId).toBeNull();
    expect(oddEntry?.hint).toBe('No clean nested relation inferred.');
  });

  it('treats duplicate active quantities as parallel levels without containment', () => {
    const unit = makeLevel({ code: 'EA', name: 'Unit', isBase: true, baseUnitQty: 1, sortOrder: 0 });
    const cartonA = makeLevel({ code: 'CTN-A', name: 'Carton A', baseUnitQty: 24, sortOrder: 1 });
    const cartonB = makeLevel({ code: 'CTN-B', name: 'Carton B', baseUnitQty: 24, sortOrder: 2 });

    const result = derivePackagingHierarchy([unit, cartonA, cartonB]);

    expect(result.hasParallelActiveLevels).toBe(true);
    const entryA = result.entries.find((entry) => entry.id === cartonA.id);
    const entryB = result.entries.find((entry) => entry.id === cartonB.id);

    expect(entryA?.nestedChildId).toBeNull();
    expect(entryB?.nestedChildId).toBeNull();
    expect(entryA?.hint).toBe('Parallel level: same unit quantity as another active level.');
    expect(entryB?.hint).toBe('Parallel level: same unit quantity as another active level.');
  });

  it('keeps base level visible as root reference even when inactive', () => {
    const inactiveBase = makeLevel({
      code: 'EA',
      name: 'Unit',
      isBase: true,
      baseUnitQty: 1,
      isActive: false,
      sortOrder: 0
    });
    const inner = makeLevel({ code: 'INR', name: 'Inner box', baseUnitQty: 6, sortOrder: 1 });
    const carton = makeLevel({ code: 'CTN', name: 'Carton', baseUnitQty: 24, sortOrder: 2 });

    const result = derivePackagingHierarchy([inactiveBase, inner, carton]);

    expect(result.entries[0]?.id).toBe(inactiveBase.id);
    expect(result.entries[0]?.isReferenceRoot).toBe(true);
    expect(result.entries[0]?.isActive).toBe(false);
    expect(result.entries[0]?.hint).toBe('Base reference level is inactive; shown as root reference only.');
  });
});
