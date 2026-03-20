import { describe, expect, it } from 'vitest';
import { inventoryItemSchema } from './inventory-item';

describe('inventory item storage contracts', () => {
  it('parses current container content rows', () => {
    expect(
      inventoryItemSchema.parse({
        id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        itemRef: 'ITEM-001',
        product: null,
        quantity: 5,
        uom: 'pcs',
        createdAt: '2026-03-13T10:00:00.000Z',
        createdBy: '945e796c-1fd6-471d-8992-a7810fd3567f'
      })
    ).toMatchObject({
      itemRef: 'ITEM-001',
      quantity: 5,
      uom: 'pcs'
    });
  });

  it('allows zero quantity as current content truth', () => {
    expect(
      inventoryItemSchema.parse({
        id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        itemRef: 'ITEM-001',
        product: null,
        quantity: 0,
        uom: 'pcs',
        createdAt: '2026-03-13T10:00:00.000Z',
        createdBy: null
      })
    ).toMatchObject({
      quantity: 0,
      createdBy: null
    });
  });
});
