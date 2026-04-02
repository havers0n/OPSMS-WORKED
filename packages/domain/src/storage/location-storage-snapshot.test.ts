import { describe, expect, it } from 'vitest';
import { locationStorageSnapshotRowSchema } from './location-storage-snapshot';

describe('location storage snapshot contracts', () => {
  it('parses populated location storage rows with systemCode', () => {
    expect(
      locationStorageSnapshotRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        floorId: '7caa9e8d-4349-4623-ad98-9e2f2af193c0',
        locationId: '8caa9e8d-4349-4623-ad98-9e2f2af193c0',
        locationCode: 'A-01-01',
        locationType: 'rack_slot',
        cellId: '9caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        systemCode: 'CNT-000003',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-01-01T00:00:00.000Z',
        itemRef: 'ITEM-001',
        product: null,
        quantity: 5,
        uom: 'pcs'
      })
    ).toMatchObject({
      systemCode: 'CNT-000003',
      itemRef: 'ITEM-001',
      quantity: 5
    });
  });
});
