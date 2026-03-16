import { describe, expect, it } from 'vitest';
import { inventoryUnitSchema } from './inventory-unit';

describe('inventory unit storage contracts', () => {
  it('parses canonical inventory units with stage 4 metadata', () => {
    expect(
      inventoryUnitSchema.parse({
        id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        productId: '945e796c-1fd6-471d-8992-a7810fd3567f',
        quantity: 5,
        uom: 'pcs',
        lotCode: null,
        serialNo: null,
        expiryDate: null,
        status: 'available',
        createdAt: '2026-03-13T10:00:00.000Z',
        updatedAt: '2026-03-13T10:05:00.000Z',
        createdBy: '945e796c-1fd6-471d-8992-a7810fd3567f',
        updatedBy: '945e796c-1fd6-471d-8992-a7810fd3567f',
        sourceInventoryUnitId: null
      })
    ).toMatchObject({
      quantity: 5,
      status: 'available',
      updatedBy: '945e796c-1fd6-471d-8992-a7810fd3567f'
    });
  });
});
