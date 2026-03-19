import { describe, expect, it } from 'vitest';
import { stockMovementSchema, stockMovementTypeSchema } from './stock-movement';

describe('stock movement execution contracts', () => {
  it('accepts stage 4 canonical movement types', () => {
    expect(stockMovementTypeSchema.parse('move_container')).toBe('move_container');
    expect(stockMovementTypeSchema.parse('split_stock')).toBe('split_stock');
    expect(stockMovementTypeSchema.parse('transfer_stock')).toBe('transfer_stock');
    expect(stockMovementTypeSchema.parse('pick_partial')).toBe('pick_partial');
  });

  it('accepts placement movement types (place_container, remove_container)', () => {
    expect(stockMovementTypeSchema.parse('place_container')).toBe('place_container');
    expect(stockMovementTypeSchema.parse('remove_container')).toBe('remove_container');
  });

  it('parses canonical stock movement rows without product duplication', () => {
    expect(
      stockMovementSchema.parse({
        id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        movementType: 'transfer_stock',
        sourceLocationId: '945e796c-1fd6-471d-8992-a7810fd3567f',
        targetLocationId: null,
        sourceContainerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        targetContainerId: 'b96d9da6-9fd7-4e8f-a4b4-7fd29af6338d',
        sourceInventoryUnitId: '5ef85941-5aaf-45cf-acfc-e7b89a014c2b',
        targetInventoryUnitId: '33335124-7ddf-44d1-aafb-2c5ea17342ff',
        quantity: 2,
        uom: 'pcs',
        status: 'done',
        createdAt: '2026-03-13T10:00:00.000Z',
        completedAt: '2026-03-13T10:00:00.000Z',
        createdBy: null
      })
    ).toMatchObject({
      movementType: 'transfer_stock',
      quantity: 2,
      targetLocationId: null
    });
  });
});
