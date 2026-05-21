import { describe, expect, it } from 'vitest';
import { buildFaceAccessByFaceId } from './face-access-map';

describe('buildFaceAccessByFaceId', () => {
  it('builds the map expected by the pick point resolver', () => {
    const map = buildFaceAccessByFaceId({
      floorId: '11111111-1111-4111-8111-111111111111',
      aisles: [],
      faceAccess: [
        {
          faceId: '22222222-2222-4222-8222-222222222222',
          aisleId: '33333333-3333-4333-8333-333333333333',
          normalX: 0,
          normalY: -1
        }
      ]
    });

    expect(map?.get('22222222-2222-4222-8222-222222222222')).toEqual({
      faceId: '22222222-2222-4222-8222-222222222222',
      normalX: 0,
      normalY: -1
    });
  });

  it('returns undefined when topology is missing or empty', () => {
    expect(buildFaceAccessByFaceId(null)).toBeUndefined();
    expect(
      buildFaceAccessByFaceId({
        floorId: '11111111-1111-4111-8111-111111111111',
        aisles: [],
        faceAccess: []
      })
    ).toBeUndefined();
  });

  it('omits duplicate face access rows instead of overwriting normals', () => {
    const map = buildFaceAccessByFaceId({
      floorId: '11111111-1111-4111-8111-111111111111',
      aisles: [],
      faceAccess: [
        {
          faceId: '22222222-2222-4222-8222-222222222222',
          aisleId: '33333333-3333-4333-8333-333333333333',
          normalX: 0,
          normalY: -1
        },
        {
          faceId: '22222222-2222-4222-8222-222222222222',
          aisleId: '44444444-4444-4444-8444-444444444444',
          normalX: 1,
          normalY: 0
        },
        {
          faceId: '55555555-5555-4555-8555-555555555555',
          aisleId: '33333333-3333-4333-8333-333333333333',
          normalX: 0,
          normalY: 1
        }
      ]
    });

    expect(map?.has('22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(map?.get('55555555-5555-4555-8555-555555555555')).toEqual({
      faceId: '55555555-5555-4555-8555-555555555555',
      normalX: 0,
      normalY: 1
    });
  });
});
