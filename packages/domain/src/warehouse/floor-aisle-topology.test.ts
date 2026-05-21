import { describe, expect, it } from 'vitest';
import { floorAisleTopologySchema } from './floor-aisle-topology';

describe('floorAisleTopologySchema', () => {
  it('accepts active aisle topology DTO with required finite face access normals', () => {
    expect(
      floorAisleTopologySchema.parse({
        floorId: '11111111-1111-4111-8111-111111111111',
        aisles: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            floorId: '11111111-1111-4111-8111-111111111111',
            code: 'A-01',
            name: null
          }
        ],
        faceAccess: [
          {
            faceId: '33333333-3333-4333-8333-333333333333',
            aisleId: '22222222-2222-4222-8222-222222222222',
            normalX: 0,
            normalY: -1
          }
        ]
      })
    ).toEqual({
      floorId: '11111111-1111-4111-8111-111111111111',
      aisles: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          floorId: '11111111-1111-4111-8111-111111111111',
          code: 'A-01',
          name: null
        }
      ],
      faceAccess: [
        {
          faceId: '33333333-3333-4333-8333-333333333333',
          aisleId: '22222222-2222-4222-8222-222222222222',
          normalX: 0,
          normalY: -1
        }
      ]
    });
  });

  it('rejects nullable or non-finite face access normals', () => {
    expect(() =>
      floorAisleTopologySchema.parse({
        floorId: '11111111-1111-4111-8111-111111111111',
        aisles: [],
        faceAccess: [
          {
            faceId: '33333333-3333-4333-8333-333333333333',
            aisleId: '22222222-2222-4222-8222-222222222222',
            normalX: null,
            normalY: Number.NaN
          }
        ]
      })
    ).toThrow();
  });
});
