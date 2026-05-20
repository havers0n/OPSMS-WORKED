import type { LayoutDraft, Rack, Wall } from '@wos/domain';
import { describe, expect, it } from 'vitest';
import {
  buildRackRouteObstacle,
  buildRouteObstaclesFromLayout,
  buildWallRouteObstacle
} from './obstacle-builders';

function rackFixture(patch: Partial<Rack> = {}): Rack {
  return {
    id: 'rack-1',
    displayCode: '01',
    kind: 'single',
    axis: 'NS',
    x: 10,
    y: 20,
    totalLength: 5,
    depth: 1.2,
    rotationDeg: 0,
    faces: [
      {
        id: 'face-a',
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        relationshipMode: 'independent',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: []
      },
      {
        id: 'face-b',
        side: 'B',
        enabled: false,
        slotNumberingDirection: 'ltr',
        relationshipMode: 'independent',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: []
      }
    ],
    ...patch
  };
}

function wallFixture(patch: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-1',
    code: 'W01',
    name: 'Wall 01',
    wallType: 'generic',
    x1: 1,
    y1: 2,
    x2: 5,
    y2: 2,
    blocksRackPlacement: true,
    ...patch
  };
}

describe('obstacle builders', () => {
  it('builds rack body bounds in world metres', () => {
    expect(buildRackRouteObstacle(rackFixture())).toEqual({
      type: 'rack',
      id: 'rack-1',
      x: 10,
      y: 20,
      width: 5,
      height: 1.2
    });
  });

  it('uses the correct AABB for 90 and 270 degree rotated racks', () => {
    const rotated90 = buildRackRouteObstacle(
      rackFixture({ rotationDeg: 90, x: 10, y: 20, totalLength: 6, depth: 2 })
    );
    const rotated270 = buildRackRouteObstacle(
      rackFixture({ rotationDeg: 270, x: 10, y: 20, totalLength: 6, depth: 2 })
    );

    expect(rotated90.type).toBe('rack');
    expect(rotated270.type).toBe('rack');
    if (rotated90.type !== 'rack' || rotated270.type !== 'rack') return;
    expect(rotated90.x).toBeCloseTo(12);
    expect(rotated90.y).toBeCloseTo(18);
    expect(rotated90.width).toBeCloseTo(2);
    expect(rotated90.height).toBeCloseTo(6);
    expect(rotated270.x).toBeCloseTo(12);
    expect(rotated270.y).toBeCloseTo(18);
    expect(rotated270.width).toBeCloseTo(2);
    expect(rotated270.height).toBeCloseTo(6);
  });

  it('includes blocking walls and excludes non-blocking walls', () => {
    expect(buildWallRouteObstacle(wallFixture())).toEqual({
      type: 'wall',
      id: 'wall-1',
      x1: 1,
      y1: 2,
      x2: 5,
      y2: 2
    });
    expect(
      buildWallRouteObstacle(wallFixture({ blocksRackPlacement: false }))
    ).toBeNull();
  });

  it('builds only rack bodies and blocking walls from a layout draft', () => {
    const blockingWall = wallFixture({ id: 'blocking-wall' });
    const nonBlockingWall = wallFixture({
      id: 'non-blocking-wall',
      blocksRackPlacement: false
    });
    const layout: LayoutDraft = {
      layoutVersionId: 'layout-version-1',
      draftVersion: 1,
      floorId: 'floor-1',
      state: 'draft',
      versionNo: 1,
      rackIds: ['rack-1'],
      racks: { 'rack-1': rackFixture() },
      wallIds: ['blocking-wall', 'non-blocking-wall'],
      walls: {
        'blocking-wall': blockingWall,
        'non-blocking-wall': nonBlockingWall
      },
      zoneIds: ['zone-ignored'],
      zones: {
        'zone-ignored': {
          id: 'zone-ignored',
          code: 'Z01',
          name: 'Zone',
          category: null,
          color: '#38bdf8',
          x: 0,
          y: 0,
          width: 10,
          height: 10
        }
      }
    };

    expect(buildRouteObstaclesFromLayout(layout).map((obstacle) => obstacle.id)).toEqual([
      'rack-1',
      'blocking-wall'
    ]);
  });
});
