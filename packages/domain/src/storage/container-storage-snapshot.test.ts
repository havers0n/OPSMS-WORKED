import { describe, expect, it } from 'vitest';
import { containerStorageSnapshotRowSchema } from './container-storage-snapshot';

describe('container storage snapshot contracts', () => {
  it('parses populated container storage rows', () => {
    expect(
      containerStorageSnapshotRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        systemCode: 'CNT-000001',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        inventoryUnitId: '7a5d7d7b-20f2-4d61-9a0b-900bcdf5a9de',
        itemRef: 'ITEM-001',
        product: null,
        quantity: 5,
        uom: 'pcs',
        packagingState: 'sealed',
        productPackagingLevelId: '945e796c-1fd6-471d-8992-a7810fd3567f',
        packCount: 1
      })
    ).toMatchObject({
      inventoryUnitId: '7a5d7d7b-20f2-4d61-9a0b-900bcdf5a9de',
      itemRef: 'ITEM-001',
      quantity: 5,
      packagingState: 'sealed'
    });
  });

  it('keeps empty containers representable with null content fields', () => {
    expect(
      containerStorageSnapshotRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        systemCode: 'CNT-000002',
        externalCode: 'PALLET-EMPTY',
        containerType: 'pallet',
        containerStatus: 'active',
        inventoryUnitId: null,
        itemRef: null,
        product: null,
        quantity: null,
        uom: null,
        packagingState: null,
        productPackagingLevelId: null,
        packCount: null
      })
    ).toMatchObject({
      inventoryUnitId: null,
      itemRef: null,
      quantity: null,
      uom: null,
      packagingState: null
    });
  });
});
