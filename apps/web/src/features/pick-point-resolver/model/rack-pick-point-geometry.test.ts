import { describe, expect, it } from 'vitest';
import type { CellLike, RackLike } from './pick-point-types';
import {
  inferRackFaceNormal,
  isPointInsideRackBody,
  rackLocalPointToWorld,
  resolveRackFaceAnchor
} from './rack-pick-point-geometry';

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

describe('rack pick point geometry', () => {
  it('infers face A normals for rotations 0/90/180/270', () => {
    expect(inferRackFaceNormal('A', 0)).toEqual({ x: 0, y: -1 });
    expect(inferRackFaceNormal('A', 90).x).toBeCloseTo(1);
    expect(inferRackFaceNormal('A', 90).y).toBeCloseTo(0);
    expect(inferRackFaceNormal('A', 180).x).toBeCloseTo(0);
    expect(inferRackFaceNormal('A', 180).y).toBeCloseTo(1);
    expect(inferRackFaceNormal('A', 270).x).toBeCloseTo(-1);
    expect(inferRackFaceNormal('A', 270).y).toBeCloseTo(0);
  });

  it('keeps face A and B normals on opposite sides', () => {
    for (const rotationDeg of [0, 90, 180, 270] as const) {
      const faceA = inferRackFaceNormal('A', rotationDeg);
      const faceB = inferRackFaceNormal('B', rotationDeg);

      expect(faceA.x).toBeCloseTo(-faceB.x);
      expect(faceA.y).toBeCloseTo(-faceB.y);
    }
  });

  it('places face anchors on the expected rack sides', () => {
    const rack = rackFixture();
    const faceA = rack.faces?.[0];
    const faceB = rack.faces?.[1];
    expect(faceA).toBeDefined();
    expect(faceB).toBeDefined();
    if (!faceA || !faceB) return;

    const anchorA = resolveRackFaceAnchor({
      rack,
      cell: cellFixture(),
      face: faceA,
      faceSide: 'A'
    });
    const anchorB = resolveRackFaceAnchor({
      rack,
      cell: cellFixture({
        id: 'cell-b-2',
        rackFaceId: 'face-b',
        rackSectionId: 'section-b',
        rackLevelId: 'level-b'
      }),
      face: faceB,
      faceSide: 'B'
    });

    expect(anchorA.status).toBe('ok');
    expect(anchorB.status).toBe('ok');
    if (anchorA.status !== 'ok' || anchorB.status !== 'ok') return;
    expect(anchorA.anchor).toEqual({ x: 11.5, y: 20 });
    expect(anchorB.anchor).toEqual({ x: 11.5, y: 22 });
  });

  it('applies approach offset outward from the face anchor', () => {
    const rack = rackFixture();
    const face = rack.faces?.[0];
    expect(face).toBeDefined();
    if (!face) return;

    const anchor = resolveRackFaceAnchor({
      rack,
      cell: cellFixture(),
      face,
      faceSide: 'A'
    });
    expect(anchor.status).toBe('ok');
    if (anchor.status !== 'ok') return;

    const normal = inferRackFaceNormal('A', rack.rotationDeg);
    const point = {
      x: anchor.anchor.x + normal.x * 0.6,
      y: anchor.anchor.y + normal.y * 0.6
    };

    expect(point.x).toBeCloseTo(anchor.anchor.x);
    expect(point.y).toBeCloseTo(anchor.anchor.y - 0.6);
  });

  it('detects outside points after rack rotation', () => {
    const rack = rackFixture({ rotationDeg: 90 });
    const inside = rackLocalPointToWorld(rack, { x: 2, y: 1 });
    const outside = rackLocalPointToWorld(rack, { x: 2, y: -0.6 });

    expect(inside).not.toBeNull();
    expect(outside).not.toBeNull();
    if (!inside || !outside) return;
    expect(isPointInsideRackBody(rack, inside)).toBe(true);
    expect(isPointInsideRackBody(rack, outside)).toBe(false);
  });
});
