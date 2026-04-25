import { describe, expect, it } from 'vitest';
import {
  createContainerFromStoragePresetBodySchema,
  createContainerFromStoragePresetResultSchema,
  storagePresetSchema
} from './storage-preset';

describe('storage preset schemas', () => {
  it('parses a storage packaging profile with levels', () => {
    const parsed = storagePresetSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      productId: '33333333-3333-4333-8333-333333333333',
      code: 'PAL-8CTN',
      name: 'Pallet / 8 cartons',
      profileType: 'storage',
      scopeType: 'tenant',
      scopeId: '22222222-2222-4222-8222-222222222222',
      validFrom: null,
      validTo: null,
      priority: 0,
      isDefault: false,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      levels: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          profileId: '11111111-1111-4111-8111-111111111111',
          levelType: 'CTN',
          qtyEach: 16,
          parentLevelType: null,
          qtyPerParent: null,
          containerType: 'pallet',
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
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    });

    expect(parsed.profileType).toBe('storage');
    expect(parsed.levels[0]?.containerType).toBe('pallet');
  });

  it('parses create-from-preset result shape', () => {
    expect(
      createContainerFromStoragePresetResultSchema.parse({
        containerId: '11111111-1111-4111-8111-111111111111',
        systemCode: 'CNT-000001',
        externalCode: null,
        containerTypeId: '22222222-2222-4222-8222-222222222222',
        packagingProfileId: '33333333-3333-4333-8333-333333333333',
        isStandardPack: true,
        placedLocationId: null,
        materializationMode: 'shell',
        materializationStatus: 'shell',
        materializationErrorCode: null,
        materializationErrorMessage: null,
        materializedInventoryUnitId: null,
        materializedContainerLineId: null,
        materializedQuantity: null
      }).isStandardPack
    ).toBe(true);
  });

  it('parses explicit partial success when materialization fails after shell creation', () => {
    const parsed = createContainerFromStoragePresetResultSchema.parse({
      containerId: '11111111-1111-4111-8111-111111111111',
      systemCode: 'CNT-000001',
      externalCode: null,
      containerTypeId: '22222222-2222-4222-8222-222222222222',
      packagingProfileId: '33333333-3333-4333-8333-333333333333',
      isStandardPack: true,
      placedLocationId: '44444444-4444-4444-8444-444444444444',
      materializationMode: 'shell',
      materializationStatus: 'partial_failed',
      materializationErrorCode: 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED',
      materializationErrorMessage: 'Storage preset must have exactly one materializable level for this phase.',
      materializedInventoryUnitId: null,
      materializedContainerLineId: null,
      materializedQuantity: null
    });

    expect(parsed.materializationStatus).toBe('partial_failed');
  });

  it('defaults create-from-preset materialization to shell mode', () => {
    expect(createContainerFromStoragePresetBodySchema.parse({}).materializeContents).toBe(false);
  });
});
