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
        itemRef: 'ITEM-001',
        product: null,
        quantity: 5,
        uom: 'pcs'
      })
    ).toMatchObject({
      itemRef: 'ITEM-001',
      quantity: 5
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
        itemRef: null,
        product: null,
        quantity: null,
        uom: null
      })
    ).toMatchObject({
      itemRef: null,
      quantity: null,
      uom: null
    });
  });
});
