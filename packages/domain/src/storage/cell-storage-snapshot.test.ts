import { describe, expect, it } from 'vitest';
import { cellStorageSnapshotRowSchema } from './cell-storage-snapshot';

describe('cell storage snapshot contracts', () => {
  it('parses placement-derived storage rows', () => {
    expect(
      cellStorageSnapshotRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T10:00:00.000Z',
        itemRef: 'ITEM-001',
        product: null,
        quantity: 5,
        uom: 'pcs'
      })
    ).toMatchObject({
      containerType: 'pallet',
      itemRef: 'ITEM-001'
    });
  });

  it('keeps empty placed containers representable with null content fields', () => {
    expect(
      cellStorageSnapshotRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        externalCode: 'PALLET-EMPTY',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T10:00:00.000Z',
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
