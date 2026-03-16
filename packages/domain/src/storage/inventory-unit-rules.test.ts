import { describe, expect, it } from 'vitest';
import {
  canMergeInventoryUnits,
  canSplitInventoryUnit,
  isSerialTrackedUnit,
  sameTrackingIdentity
} from './inventory-unit-rules';

const baseUnit = {
  id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
  tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
  containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
  productId: '945e796c-1fd6-471d-8992-a7810fd3567f',
  quantity: 5,
  uom: 'pcs',
  lotCode: null,
  serialNo: null,
  expiryDate: null,
  status: 'available' as const,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  sourceInventoryUnitId: null
};

describe('inventory unit execution rules', () => {
  it('matches tracking identity without container semantics', () => {
    const sameIdentityOtherContainer = {
      ...baseUnit,
      containerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };

    expect(
      sameTrackingIdentity(baseUnit, sameIdentityOtherContainer)
    ).toBe(true);
  });

  it('only merges exact-match non-serial rows in the same container', () => {
    expect(canMergeInventoryUnits(baseUnit, { ...baseUnit })).toBe(true);
    expect(
      canMergeInventoryUnits(baseUnit, {
        ...baseUnit,
        containerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      })
    ).toBe(false);
    expect(
      canMergeInventoryUnits(baseUnit, {
        ...baseUnit,
        serialNo: 'SER-001'
      })
    ).toBe(false);
  });

  it('allows partial split of non-serial rows only', () => {
    expect(canSplitInventoryUnit(baseUnit, 2)).toBe(true);
    expect(canSplitInventoryUnit(baseUnit, 0)).toBe(false);
    expect(canSplitInventoryUnit(baseUnit, 5)).toBe(false);
    expect(
      canSplitInventoryUnit(
        {
          ...baseUnit,
          quantity: 1,
          serialNo: 'SER-001'
        },
        0.5
      )
    ).toBe(false);
  });

  it('recognizes serial-tracked units from serialNo', () => {
    expect(isSerialTrackedUnit(baseUnit)).toBe(false);
    expect(
      isSerialTrackedUnit({
        ...baseUnit,
        serialNo: 'SER-001'
      })
    ).toBe(true);
  });
});
