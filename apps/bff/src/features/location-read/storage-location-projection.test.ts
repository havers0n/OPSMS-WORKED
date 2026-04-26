import { describe, expect, it } from 'vitest';
import { mapStorageLocationProjection } from './storage-location-projection.js';

const baseRow = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  floor_id: '33333333-3333-4333-8333-333333333333',
  code: '06-B.03.01.01'
};

describe('mapStorageLocationProjection', () => {
  it('returns routeSequence from explicit route_sequence', () => {
    const projection = mapStorageLocationProjection({
      ...baseRow,
      sort_order: 20,
      route_sequence: 7
    });

    expect(projection.routeSequence).toBe(7);
  });

  it('falls back to sort_order when route_sequence is missing', () => {
    const projection = mapStorageLocationProjection({
      ...baseRow,
      sort_order: 14,
      route_sequence: null
    });

    expect(projection.routeSequence).toBe(14);
  });

  it('uses location code for addressLabel', () => {
    const projection = mapStorageLocationProjection(baseRow);
    expect(projection.addressLabel).toBe('06-B.03.01.01');
  });

  it('keeps geometry_slot_id as optional cellId bridge', () => {
    const projection = mapStorageLocationProjection({
      ...baseRow,
      geometry_slot_id: '44444444-4444-4444-8444-444444444444'
    });

    expect(projection.cellId).toBe('44444444-4444-4444-8444-444444444444');
  });

  it('supports non-rack/floor location without cell mapping', () => {
    const projection = mapStorageLocationProjection({
      ...baseRow,
      geometry_slot_id: null,
      floor_x: 3.5,
      floor_y: 1.25
    });

    expect(projection.cellId).toBeUndefined();
    expect(projection.x).toBe(3.5);
    expect(projection.y).toBe(1.25);
  });
});
