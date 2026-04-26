import { describe, expect, it } from 'vitest';
import type { ProductPackagingLevel, StoragePreset } from '@wos/domain';
import { derivePackagingHierarchy, formatPackCount, groupStoragePresetsByPackagingLevelId } from './packaging-hierarchy';

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

function makePreset(overrides: Partial<StoragePreset> = {}): StoragePreset {
  const presetId = overrides.id ?? crypto.randomUUID();

  return {
    id: presetId,
    tenantId: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    code: overrides.code ?? 'PAL-12',
    name: overrides.name ?? 'Pallet 12 Master',
    profileType: 'storage',
    scopeType: 'tenant',
    scopeId: crypto.randomUUID(),
    validFrom: null,
    validTo: null,
    priority: 0,
    isDefault: overrides.isDefault ?? false,
    status: overrides.status ?? 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    levels:
      overrides.levels ??
      [
        {
          id: crypto.randomUUID(),
          profileId: presetId,
          levelType: 'MASTER',
          qtyEach: 600,
          parentLevelType: null,
          qtyPerParent: null,
          containerType: 'PALLET',
          tareWeightG: null,
          nominalGrossWeightG: null,
          lengthMm: null,
          widthMm: null,
          heightMm: null,
          casesPerTier: null,
          tiersPerPallet: null,
          maxStackHeight: null,
          maxStackWeight: null,
          legacyProductPackagingLevelId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
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

describe('storage hierarchy helpers', () => {
  it('formats divisible pack counts without fractional values', () => {
    expect(formatPackCount(600, 50, 'MASTER')).toEqual({
      countText: 'Count: 12 MASTER',
      totalText: 'Total: 600 EA',
      warning: null
    });
  });

  it('warns when total each does not divide cleanly by the pack size', () => {
    expect(formatPackCount(610, 50, 'MASTER')).toEqual({
      countText: null,
      totalText: 'Total: 610 EA',
      warning: 'Does not divide cleanly by MASTER size 50 EA.'
    });
  });

  it('groups presets only under active rendered hierarchy levels', () => {
    const each = makeLevel({ code: 'EA', name: 'Each', isBase: true, baseUnitQty: 1, sortOrder: 0 });
    const master = makeLevel({ code: 'MASTER', name: 'Master', baseUnitQty: 50, sortOrder: 1 });
    const hierarchy = derivePackagingHierarchy([each, master]);
    const presetA = makePreset({
      id: crypto.randomUUID(),
      code: 'PAL-A',
      levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: master.id }]
    });
    const presetB = makePreset({
      id: crypto.randomUUID(),
      code: 'PAL-B',
      levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: master.id, qtyEach: 1200 }]
    });

    const grouped = groupStoragePresetsByPackagingLevelId([presetA, presetB], hierarchy.entries, [each, master]);

    expect(grouped.byPackagingLevelId.get(master.id)?.map((item) => item.preset.code)).toEqual(['PAL-A', 'PAL-B']);
    expect(grouped.unlinked).toHaveLength(0);
  });

  it('keeps missing, inactive, and absent links visible as unlinked storage', () => {
    const each = makeLevel({ code: 'EA', name: 'Each', isBase: true, baseUnitQty: 1, sortOrder: 0 });
    const inactiveMaster = makeLevel({
      code: 'MASTER',
      name: 'Master',
      baseUnitQty: 50,
      sortOrder: 1,
      isActive: false
    });
    const absentLevel = makeLevel({ code: 'ALT', name: 'Alternate', baseUnitQty: 25, sortOrder: 2 });
    const hierarchy = derivePackagingHierarchy([each, inactiveMaster]);
    const missingLink = makePreset({ code: 'NO-LINK', levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: null }] });
    const unresolvedLink = makePreset({
      code: 'MISSING',
      levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: crypto.randomUUID() }]
    });
    const inactiveLink = makePreset({
      code: 'INACTIVE',
      levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: inactiveMaster.id }]
    });
    const absentLink = makePreset({
      code: 'ABSENT',
      levels: [{ ...makePreset().levels[0], legacyProductPackagingLevelId: absentLevel.id }]
    });
    const noLevels = makePreset({ code: 'EMPTY', levels: [] });

    const grouped = groupStoragePresetsByPackagingLevelId(
      [missingLink, unresolvedLink, inactiveLink, absentLink, noLevels],
      hierarchy.entries,
      [each, inactiveMaster, absentLevel]
    );

    expect([...grouped.byPackagingLevelId.values()].flat()).toHaveLength(0);
    expect(grouped.unlinked.map((item) => item.preset.code)).toEqual([
      'NO-LINK',
      'MISSING',
      'INACTIVE',
      'ABSENT',
      'EMPTY'
    ]);
    expect(grouped.unlinked.flatMap((item) => item.warnings)).toContain(
      'This storage preset is missing a packaging-level link. Recreate or update it after selecting an active storable pack type.'
    );
    expect(grouped.unlinked.flatMap((item) => item.warnings)).toContain(
      'The saved packaging-level link points to a level that no longer exists. Recreate or update this storage preset.'
    );
    expect(grouped.unlinked.flatMap((item) => item.warnings)).toContain(
      'Linked packaging level MASTER is inactive. Activate it or link this preset to an active level.'
    );
    expect(grouped.unlinked.flatMap((item) => item.warnings)).toContain(
      'Linked packaging level ALT is not shown in the active hierarchy. Check its quantity relation or hierarchy settings.'
    );
    expect(grouped.unlinked.flatMap((item) => item.warnings)).toContain('No composition levels.');
  });
});
