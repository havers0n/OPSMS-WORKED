import { describe, expect, it } from 'vitest';
import type { CellLike, RackLike } from './pick-point-types';
import { resolvePickPoint } from './pick-point-resolver';
import {
  isPointInsideRackBody,
  rackLocalPointToWorld
} from './rack-pick-point-geometry';
import { isPointBlocked, solveGridRoute } from '../../obstacle-route-planning/model/grid-route-solver';
import type { RouteObstacle } from '../../obstacle-route-planning/model/obstacle-types';

function rackFixture(patch: Partial<RackLike> = {}): RackLike {
  return {
    id: 'rack-1',
    kind: 'paired',
    x: 10,
    y: 20,
    totalLength: 4,
    depth: 2,
    rotationDeg: 0,
    faces: [
      {
        id: 'face-a',
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        sections: [
          {
            id: 'section-a',
            ordinal: 1,
            length: 4,
            levels: [{ id: 'level-a', ordinal: 1, slotCount: 4 }]
          }
        ]
      },
      {
        id: 'face-b',
        side: 'B',
        enabled: true,
        slotNumberingDirection: 'ltr',
        sections: [
          {
            id: 'section-b',
            ordinal: 1,
            length: 4,
            levels: [{ id: 'level-b', ordinal: 1, slotCount: 4 }]
          }
        ]
      }
    ],
    ...patch
  };
}

function cellFixture(patch: Partial<CellLike> = {}): CellLike {
  return {
    id: 'cell-a-2',
    rackId: 'rack-1',
    rackFaceId: 'face-a',
    rackSectionId: 'section-a',
    rackLevelId: 'level-a',
    slotNo: 2,
    ...patch
  };
}

function resolverInput(args: {
  location?: Parameters<typeof resolvePickPoint>[0]['location'];
  rack?: RackLike;
  cell?: CellLike;
  cellsById?: Map<string, CellLike>;
  racksById?: Map<string, RackLike>;
  faceAccessByFaceId?: Parameters<typeof resolvePickPoint>[0]['faceAccessByFaceId'];
  approachOffsetM?: number;
} = {}): Parameters<typeof resolvePickPoint>[0] {
  const rack = args.rack ?? rackFixture();
  const cell = args.cell ?? cellFixture();
  const defaultLocation = {
    id: 'loc-1',
    locationType: 'rack_slot',
    geometrySlotId: cell.id
  };
  const location = Object.prototype.hasOwnProperty.call(args, 'location')
    ? args.location ?? null
    : defaultLocation;

  return {
    location,
    cellsById: args.cellsById ?? new Map([[cell.id, cell]]),
    racksById: args.racksById ?? new Map([[rack.id, rack]]),
    faceAccessByFaceId: args.faceAccessByFaceId,
    config: args.approachOffsetM !== undefined
      ? { approachOffsetM: args.approachOffsetM }
      : undefined
  };
}

function expectOk(result: ReturnType<typeof resolvePickPoint>) {
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') {
    throw new Error(`Expected ok resolution, got ${result.status}: ${result.reason}`);
  }
  return result.pickPoint;
}

describe('resolvePickPoint', () => {
  it('resolves finite non-rack floor coordinates exactly', () => {
    const result = resolvePickPoint(resolverInput({
      location: {
        id: 'floor-loc',
        locationType: 'staging',
        floorX: 3.25,
        floorY: 4.75
      }
    }));

    expect(result).toEqual({
      status: 'ok',
      pickPoint: {
        x: 3.25,
        y: 4.75,
        locationId: 'floor-loc',
        source: 'non_rack_location'
      }
    });
  });

  it('returns missing_geometry for non-rack locations without floor coordinates', () => {
    const result = resolvePickPoint(resolverInput({
      location: {
        id: 'dock-loc',
        locationType: 'dock',
        floorX: null,
        floorY: null
      }
    }));

    expect(result.status).toBe('missing_geometry');
  });

  it('returns missing_location when no location is provided', () => {
    expect(resolvePickPoint(resolverInput({ location: null })).status).toBe('missing_location');
  });

  it('resolves rack slots outside the rack body and not at cell center', () => {
    const rack = rackFixture();
    const cell = cellFixture();
    const point = expectOk(resolvePickPoint(resolverInput({ rack, cell })));
    const cellCenter = rackLocalPointToWorld(rack, { x: 1.5, y: 1 });

    expect(point).toMatchObject({
      x: 11.5,
      y: 19.4,
      locationId: 'loc-1',
      source: 'rack_face_inferred',
      cellId: cell.id,
      rackId: rack.id,
      faceId: cell.rackFaceId
    });
    expect(isPointInsideRackBody(rack, point)).toBe(false);
    expect(cellCenter).not.toBeNull();
    if (!cellCenter) return;
    expect(point).not.toEqual(cellCenter);
    expect(isPointInsideRackBody(rack, cellCenter)).toBe(true);
  });

  it('resolves rotations 0/90/180/270 with inferred face normals', () => {
    const expected = {
      0: { x: 11.5, y: 19.4 },
      90: { x: 13.6, y: 20.5 },
      180: { x: 12.5, y: 22.6 },
      270: { x: 10.4, y: 21.5 }
    };

    for (const rotationDeg of [0, 90, 180, 270] as const) {
      const point = expectOk(resolvePickPoint(resolverInput({
        rack: rackFixture({ rotationDeg })
      })));

      expect(point.x).toBeCloseTo(expected[rotationDeg].x);
      expect(point.y).toBeCloseTo(expected[rotationDeg].y);
    }
  });

  it('resolves face A and B on opposite sides', () => {
    const faceA = expectOk(resolvePickPoint(resolverInput()));
    const faceB = expectOk(resolvePickPoint(resolverInput({
      location: {
        id: 'loc-b',
        locationType: 'rack_slot',
        geometrySlotId: 'cell-b-2'
      },
      cell: cellFixture({
        id: 'cell-b-2',
        rackFaceId: 'face-b',
        rackSectionId: 'section-b',
        rackLevelId: 'level-b'
      })
    })));

    expect(faceA.y).toBeCloseTo(19.4);
    expect(faceB.y).toBeCloseTo(22.6);
  });

  it('applies custom approachOffsetM', () => {
    const point = expectOk(resolvePickPoint(resolverInput({ approachOffsetM: 1.25 })));

    expect(point.x).toBeCloseTo(11.5);
    expect(point.y).toBeCloseTo(18.75);
  });

  it('uses finite face access normal instead of fallback normal', () => {
    const point = expectOk(resolvePickPoint(resolverInput({
      faceAccessByFaceId: new Map([
        ['face-a', { faceId: 'face-a', normalX: 0, normalY: -2 }]
      ])
    })));

    expect(point.source).toBe('rack_face_access');
    expect(point.x).toBeCloseTo(11.5);
    expect(point.y).toBeCloseTo(19.4);
  });

  it('falls back when face access is missing or not finite', () => {
    const missing = expectOk(resolvePickPoint(resolverInput()));
    const invalid = expectOk(resolvePickPoint(resolverInput({
      faceAccessByFaceId: new Map([
        ['face-a', { faceId: 'face-a', normalX: null, normalY: Number.NaN }]
      ])
    })));

    expect(missing.source).toBe('rack_face_inferred');
    expect(invalid.source).toBe('rack_face_inferred');
    expect(invalid).toMatchObject({ x: missing.x, y: missing.y });
  });

  it('returns diagnostics for missing cell, rack, and face side', () => {
    expect(resolvePickPoint(resolverInput({
      cellsById: new Map()
    }))).toMatchObject({ status: 'missing_geometry' });

    expect(resolvePickPoint(resolverInput({
      racksById: new Map()
    }))).toMatchObject({ status: 'missing_geometry' });

    expect(resolvePickPoint(resolverInput({
      rack: rackFixture({ faces: [] }),
      cell: cellFixture()
    }))).toMatchObject({ status: 'missing_geometry' });
  });

  it('returns ambiguous_face_access when a finite face access normal points inside the rack', () => {
    const result = resolvePickPoint(resolverInput({
      faceAccessByFaceId: new Map([
        ['face-a', { faceId: 'face-a', normalX: 0, normalY: 1 }]
      ])
    }));

    expect(result.status).toBe('ambiguous_face_access');
  });

  it('resolves a rack-slot point that PR 6 obstacle checks do not block by default', () => {
    const rack = rackFixture({ x: 10, y: 20, rotationDeg: 0 });
    const point = expectOk(resolvePickPoint(resolverInput({ rack })));
    const obstacle: RouteObstacle = {
      type: 'rack',
      id: rack.id,
      x: rack.x,
      y: rack.y,
      width: rack.totalLength,
      height: rack.depth
    };

    expect(isPointBlocked(point, [obstacle])).toBe(false);
  });

  it('can route from an open start to the resolved pick point with PR 6 solver', () => {
    const rack = rackFixture({ x: 10, y: 20, rotationDeg: 0 });
    const point = expectOk(resolvePickPoint(resolverInput({ rack })));
    const obstacle: RouteObstacle = {
      type: 'rack',
      id: rack.id,
      x: rack.x,
      y: rack.y,
      width: rack.totalLength,
      height: rack.depth
    };
    const result = solveGridRoute(
      { x: 8, y: 18 },
      point,
      [obstacle],
      { resolutionM: 0.1 }
    );

    expect(result.status).toBe('ok');
  });
});
