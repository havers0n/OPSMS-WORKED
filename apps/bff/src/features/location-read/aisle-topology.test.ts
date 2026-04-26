import { describe, expect, it } from 'vitest';
import { mapFaceAccessRow, mapPickAisleRow } from './aisle-topology.js';

describe('aisle topology mappers', () => {
  it('maps pick_aisles snake_case row to PickAisle', () => {
    const aisle = mapPickAisleRow({
      id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      floor_id: '33333333-3333-4333-8333-333333333333',
      code: 'AISLE-06-07',
      name: 'Aisle 6-7',
      start_x: 10,
      start_y: 20,
      end_x: 15,
      end_y: 25,
      width_mm: 1800,
      route_sequence: 30,
      status: 'active'
    });

    expect(aisle).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      floorId: '33333333-3333-4333-8333-333333333333',
      code: 'AISLE-06-07',
      name: 'Aisle 6-7',
      startX: 10,
      startY: 20,
      endX: 15,
      endY: 25,
      widthMm: 1800,
      routeSequence: 30,
      status: 'active'
    });
  });

  it('maps face_access snake_case row to FaceAccess', () => {
    const faceAccess = mapFaceAccessRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      rack_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      face_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      aisle_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      side_of_aisle: 'left',
      position_along_aisle: 3,
      normal_x: 0,
      normal_y: 1
    });

    expect(faceAccess).toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      rackId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      faceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      aisleId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      sideOfAisle: 'left',
      positionAlongAisle: 3,
      normalX: 0,
      normalY: 1
    });
  });

  it('preserves nullable side_of_aisle and numeric hints as optional', () => {
    const faceAccess = mapFaceAccessRow({
      rack_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      face_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      aisle_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      side_of_aisle: null,
      position_along_aisle: null,
      normal_x: null,
      normal_y: null
    });

    expect(faceAccess.sideOfAisle).toBeUndefined();
    expect(faceAccess.positionAlongAisle).toBeUndefined();
    expect(faceAccess.normalX).toBeUndefined();
    expect(faceAccess.normalY).toBeUndefined();
  });
});
